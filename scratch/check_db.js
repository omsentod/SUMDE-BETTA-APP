import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  console.log("SEKARANG:", now.toISOString());

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
  console.log("ONGOING COUNT:", ongoingEvents.length);

  let combined = [...ongoingEvents];
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
    console.log("UPCOMING COUNT FETCHED:", upcomingEvents.length);
    combined = [...combined, ...upcomingEvents];
  }

  console.log("TOTAL COMBINED COUNT:", combined.length);
  console.log("COMBINED DATA:", JSON.stringify(combined, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
