import prisma from '@/lib/prisma';


export async function syncUserProfileFromAddress(userId, addr) {
  if (!userId || !addr) return;
  await prisma.user.update({
    where: { id: userId },
    data: {
      phone: addr.phone,
      streetAddress: addr.streetAddress,
      rtRw: addr.rtRw,
      province: addr.province,
      city: addr.city,
      district: addr.district,
      village: addr.village,
      postalCode: addr.postalCode,
    },
  });
}
