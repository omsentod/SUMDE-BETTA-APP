import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const events = await prisma.promoEvent.findMany();
  let updated = 0;

  for (const ev of events) {
    if (typeof ev.image !== 'string') continue;
    // Match /betta-1.png, /farm-2.png, dst — asset root yang seharusnya di /img/*
    const m = ev.image.match(/^\/((?:betta|farm|giant)[-_][^/]+\.(?:png|jpe?g|webp))$/i);
    if (!m) continue;
    const fixed = `/img/${m[1]}`;
    await prisma.promoEvent.update({ where: { id: ev.id }, data: { image: fixed } });
    console.log(`✓ ${ev.title}: ${ev.image} → ${fixed}`);
    updated += 1;
  }

  console.log(`\nSelesai. ${updated} event di-update.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
