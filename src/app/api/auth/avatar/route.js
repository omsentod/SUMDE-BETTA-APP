import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { consume } from '@/lib/rateLimit';

const AVATAR_DIR = path.resolve(
  process.env.UPLOADS_DIR || path.join(process.cwd(), 'public', 'uploads')
);
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const EXT_BY_KIND = { png: '.png', jpg: '.jpg', webp: '.webp' };
const LOCAL_AVATAR_PATTERN = /^\/uploads\/(avatar-[a-f0-9]{32}\.(?:png|jpg|webp))$/i;

function detectImageKind(buf) {
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return 'png';
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'jpg';
  }
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    return 'webp';
  }
  return null;
}

function verifySameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    const originHost = new URL(origin).host;
    const expectedHosts = [
      request.headers.get('x-forwarded-host'),
      request.headers.get('host'),
    ].filter(Boolean);
    if (process.env.APP_URL) {
      try {
        expectedHosts.push(new URL(process.env.APP_URL).host);
      } catch {
        // ignore invalid APP_URL
      }
    }
    return expectedHosts.includes(originHost);
  } catch {
    return false;
  }
}

async function deleteLocalAvatarIfOwned(avatarUrl) {
  if (typeof avatarUrl !== 'string') return;
  const match = avatarUrl.match(LOCAL_AVATAR_PATTERN);
  if (!match) return;
  const safeName = path.basename(match[1]);
  const targetPath = path.resolve(AVATAR_DIR, safeName);
  if (!targetPath.startsWith(AVATAR_DIR + path.sep)) return;
  try {
    await fs.unlink(targetPath);
  } catch (err) {
    if (err?.code !== 'ENOENT') {
      console.error('Failed to remove old avatar file:', err.message);
    }
  }
}

export async function POST(request) {
  let newlyWrittenPath = null;
  try {
    if (!verifySameOrigin(request)) {
      return NextResponse.json({ error: 'Permintaan lintas origin ditolak.' }, { status: 403 });
    }

    const session = await requireUser(request);

    const rl = consume(`avatar:${session.id}`, { limit: 10, windowMs: 15 * 60 * 1000 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Terlalu sering mengganti foto profil. Coba lagi beberapa menit lagi.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'Pilih file foto terlebih dahulu.' }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Format file tidak didukung. Gunakan JPG, PNG, atau WEBP.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'Ukuran foto maksimal 2 MB.' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length === 0 || buffer.length > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'Ukuran foto tidak valid atau melebihi 2 MB.' },
        { status: 400 }
      );
    }

    const detectedKind = detectImageKind(buffer);
    if (!detectedKind) {
      return NextResponse.json(
        { error: 'File bukan gambar JPG, PNG, atau WEBP yang valid.' },
        { status: 400 }
      );
    }

    await fs.mkdir(AVATAR_DIR, { recursive: true });
    const safeFilename = `avatar-${crypto.randomBytes(16).toString('hex')}${EXT_BY_KIND[detectedKind]}`;
    const targetPath = path.resolve(AVATAR_DIR, safeFilename);
    if (!targetPath.startsWith(AVATAR_DIR + path.sep)) {
      return NextResponse.json({ error: 'Path penyimpanan tidak valid.' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({
      where: { id: session.id },
      select: { id: true, avatarUrl: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Akun tidak ditemukan.' }, { status: 404 });
    }

    await fs.writeFile(targetPath, buffer);
    newlyWrittenPath = targetPath;

    const newAvatarUrl = `/uploads/${safeFilename}`;
    await prisma.user.update({
      where: { id: session.id },
      data: { avatarUrl: newAvatarUrl },
    });
    newlyWrittenPath = null; // persisted cleanly

    // Cleanup old avatar best-effort
    await deleteLocalAvatarIfOwned(existing.avatarUrl);

    return NextResponse.json({ avatarUrl: newAvatarUrl });
  } catch (error) {
    if (newlyWrittenPath) {
      try {
        await fs.unlink(newlyWrittenPath);
      } catch {
        // ignore rollback unlink failure
      }
    }
    if (error?.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Avatar upload error:', error);
    return NextResponse.json({ error: 'Gagal mengunggah foto profil.' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    if (!verifySameOrigin(request)) {
      return NextResponse.json({ error: 'Permintaan lintas origin ditolak.' }, { status: 403 });
    }

    const session = await requireUser(request);

    const existing = await prisma.user.findUnique({
      where: { id: session.id },
      select: { id: true, avatarUrl: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Akun tidak ditemukan.' }, { status: 404 });
    }

    await prisma.user.update({
      where: { id: session.id },
      data: { avatarUrl: null },
    });

    await deleteLocalAvatarIfOwned(existing.avatarUrl);

    return NextResponse.json({ avatarUrl: null });
  } catch (error) {
    if (error?.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Avatar delete error:', error);
    return NextResponse.json({ error: 'Gagal menghapus foto profil.' }, { status: 500 });
  }
}

