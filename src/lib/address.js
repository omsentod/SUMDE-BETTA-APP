import prisma from '@/lib/prisma';

/**
 * Copy an address's location fields into the owner's User profile columns.
 * Called whenever an address becomes the user's default, so the User record
 * always mirrors the default shipping address.
 *
 * Note: recipientName is intentionally NOT copied into User.name — the account
 * name and a shipping recipient are different things.
 */
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
