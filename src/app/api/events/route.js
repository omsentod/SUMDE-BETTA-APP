import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET: Mengambil daftar event
// - Jika query ?active=true: ambil maksimal 5 event aktif (mengutamakan ongoing, diisi upcoming terdekat)
// - Jika tidak: ambil semua event (untuk admin dashboard dan halaman daftar event)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';

    if (activeOnly) {
      const now = new Date();

      // 1. Ambil event yang SEDANG BERLANGSUNG (isActive=true dan saat ini berada di antara startDate & endDate jika diset)
      const ongoingEvents = await prisma.promoEvent.findMany({
        where: {
          isActive: true,
          AND: [
            {
              OR: [
                { startDate: null },
                { startDate: { lte: now } }
              ]
            },
            {
              OR: [
                { endDate: null },
                { endDate: { gte: now } }
              ]
            }
          ]
        },
        orderBy: { createdAt: 'desc' }
      });

      let combined = [...ongoingEvents];

      // 2. Jika event berlangsung kurang dari 5, ambil sisa slot dari event MENDATANG (upcoming) terdekat
      if (combined.length < 5) {
        const slotsNeeded = 5 - combined.length;
        const upcomingEvents = await prisma.promoEvent.findMany({
          where: {
            isActive: true,
            startDate: { gt: now }
          },
          orderBy: { startDate: 'asc' },
          take: slotsNeeded
        });
        combined = [...combined, ...upcomingEvents];
      }

      return NextResponse.json(combined);
    } else {
      // Ambil semua event untuk admin dashboard atau halaman list event lengkap
      const events = await prisma.promoEvent.findMany({
        orderBy: { createdAt: 'desc' }
      });
      return NextResponse.json(events);
    }
  } catch (error) {
    console.error('Error GET events:', error);
    return NextResponse.json({ error: 'Gagal mengambil data event.' }, { status: 500 });
  }
}

// POST: Membuat event baru
export async function POST(request) {
  try {
    const body = await request.json();
    const { title, subtitle, description, image, targetUrl, buttonText, isActive, startDate, endDate } = body;

    // Validasi data wajib
    if (!title || !description || !targetUrl) {
      return NextResponse.json({ error: 'Judul, deskripsi, dan URL target wajib diisi.' }, { status: 400 });
    }

    const newEvent = await prisma.promoEvent.create({
      data: {
        title,
        subtitle: subtitle || null,
        description,
        image: image || '/betta-2.png',
        targetUrl,
        buttonText: buttonText || 'Lihat Event',
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null
      }
    });

    return NextResponse.json(newEvent, { status: 201 });
  } catch (error) {
    console.error('Error POST event:', error);
    return NextResponse.json({ error: 'Gagal membuat event baru.' }, { status: 500 });
  }
}

// PUT: Memperbarui event
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, title, subtitle, description, image, targetUrl, buttonText, isActive, startDate, endDate } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID event wajib disertakan.' }, { status: 400 });
    }

    const dataToUpdate = {};
    if (title !== undefined) dataToUpdate.title = title;
    if (subtitle !== undefined) dataToUpdate.subtitle = subtitle;
    if (description !== undefined) dataToUpdate.description = description;
    if (image !== undefined) dataToUpdate.image = image;
    if (targetUrl !== undefined) dataToUpdate.targetUrl = targetUrl;
    if (buttonText !== undefined) dataToUpdate.buttonText = buttonText;
    if (isActive !== undefined) dataToUpdate.isActive = Boolean(isActive);
    
    // Parse tanggal secara aman
    if (startDate !== undefined) {
      dataToUpdate.startDate = startDate ? new Date(startDate) : null;
    }
    if (endDate !== undefined) {
      dataToUpdate.endDate = endDate ? new Date(endDate) : null;
    }

    const updatedEvent = await prisma.promoEvent.update({
      where: { id },
      data: dataToUpdate
    });

    return NextResponse.json(updatedEvent);
  } catch (error) {
    console.error('Error PUT event:', error);
    return NextResponse.json({ error: 'Gagal memperbarui event.' }, { status: 500 });
  }
}

// DELETE: Menghapus event
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID event wajib disertakan.' }, { status: 400 });
    }

    await prisma.promoEvent.delete({
      where: { id }
    });

    return NextResponse.json({ message: 'Event berhasil dihapus.' });
  } catch (error) {
    console.error('Error DELETE event:', error);
    return NextResponse.json({ error: 'Gagal menghapus event.' }, { status: 500 });
  }
}
