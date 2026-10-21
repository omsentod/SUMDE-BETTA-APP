import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

/**
 * GET /uploads/[filename]
 *
 * Serves uploaded files from persistent UPLOADS_DIR (if set in production)
 * or falls back to public/uploads. Prevents 404s when Hostinger creates a
 * new version directory upon git push / redeployment.
 */
export async function GET(request, { params }) {
  try {
    const { filename } = await params;

    // Defense against path traversal
    if (
      !filename ||
      filename.includes('..') ||
      filename.includes('/') ||
      filename.includes('\\') ||
      path.basename(filename) !== filename
    ) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    const ext = path.extname(filename).toLowerCase();
    const contentType = MIME_TYPES[ext];
    if (!contentType) {
      return new NextResponse('Format tidak didukung', { status: 415 });
    }

    // List of candidate locations where the image might be stored
    const candidateDirs = [
      process.env.UPLOADS_DIR,
      '/home/u707667165/domains/sumdebetta.com/public_html/uploads',
      '/home/u707667165/domains/sumdebetta.com/uploads',
      path.join(process.cwd(), 'public', 'uploads'),
    ].filter(Boolean);

    let fileBuffer = null;

    // 1. Try standard candidate directories
    for (const dir of candidateDirs) {
      try {
        fileBuffer = await fs.readFile(path.join(dir, filename));
        if (fileBuffer) break;
      } catch {
        // try next
      }
    }

    // 2. If not found, search in sibling Hostinger hbuilds/versions/<UUID>/nodejs/public/uploads/
    if (!fileBuffer) {
      try {
        // Hostinger deploy path: .../hbuilds/versions/<UUID>/nodejs
        const versionsDir = path.resolve(process.cwd(), '..', '..');
        const entries = await fs.readdir(versionsDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const siblingPath = path.join(versionsDir, entry.name, 'nodejs', 'public', 'uploads', filename);
            try {
              fileBuffer = await fs.readFile(siblingPath);
              if (fileBuffer) {
                // Self-healing: save to persistent dir if possible
                if (process.env.UPLOADS_DIR) {
                  await fs.mkdir(process.env.UPLOADS_DIR, { recursive: true }).catch(() => {});
                  await fs.writeFile(path.join(process.env.UPLOADS_DIR, filename), fileBuffer).catch(() => {});
                }
                break;
              }
            } catch {
              // try next version
            }
          }
        }
      } catch {
        // ignore
      }
    }

    if (!fileBuffer) {
      return new NextResponse('Gambar tidak ditemukan', { status: 404 });
    }

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new NextResponse('Gambar tidak ditemukan', { status: 404 });
  }
}
