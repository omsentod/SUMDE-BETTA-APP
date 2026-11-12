import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';
import { createNotification } from '@/lib/notification';
import { sendMail } from '@/lib/email';

export async function POST(request, { params }) {
  try {
    await requirePermission(request, ['users:update', 'users:manage']);
    const { id } = await params;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ error: 'User tidak ditemukan.' }, { status: 404 });
    }

    const { title, body, link, type = 'admin.message', sendEmail = false } = await request.json();

    const cleanTitle = String(title || '').trim();
    const cleanBody = String(body || '').trim();

    if (!cleanTitle || !cleanBody) {
      return NextResponse.json(
        { error: 'Judul dan isi notifikasi wajib diisi.' },
        { status: 400 }
      );
    }

    const res = await createNotification({
      userId: id,
      type,
      title: cleanTitle,
      body: cleanBody,
      link: link ? String(link).trim() : null,
      channels: {
        db: true,
        ably: true,
        push: true,
        email: false,
      },
    });

    if (sendEmail) {
      try {
        await sendMail({
          to: user.email,
          subject: cleanTitle,
          html: `
            <div style="font-family:Arial,sans-serif;padding:20px;color:#1c1c1e;">
              <h2 style="color:#FF6B35;margin-top:0;">${cleanTitle}</h2>
              <p style="font-size:14px;line-height:1.6;white-space:pre-wrap;">${cleanBody}</p>
              ${
                link
                  ? `<div style="margin-top:24px;"><a href="${link}" style="background:#FF6B35;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">Buka Tautan</a></div>`
                  : ''
              }
              <hr style="margin-top:30px;border:none;border-top:1px solid #e5e5ea;" />
              <p style="font-size:12px;color:#8e8e93;">Pesan ini dikirim oleh tim administrator SUMDE BETTA.</p>
            </div>
          `,
        });
      } catch (mailErr) {
        console.error('Gagal mengirim email notifikasi khusus:', mailErr.message);
      }
    }

    return NextResponse.json({
      message: 'Notifikasi berhasil dikirim kepada pengguna.',
      notification: res.notification,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
