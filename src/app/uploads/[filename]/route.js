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

    const uploadDir = process.env.UPLOADS_DIR || path.join(process.cwd(), 'public', 'uploads');
    const targetPath = path.join(uploadDir, filename);

    let fileBuffer;
    try {
      fileBuffer = await fs.readFile(targetPath);
    } catch {
      // Fallback: check project public/uploads
      const localPath = path.join(process.cwd(), 'public', 'uploads', filename);
      fileBuffer = await fs.readFile(localPath);
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
