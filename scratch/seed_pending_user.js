import pkg from '@prisma/client';
const { PrismaClient } = pkg;
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.user.findUnique({ where: { email: 'user@sumdebetta.com' } });
  const order = await prisma.order.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
  await prisma.order.update({ where: { id: order.id }, data: { status: 'PENDING' } });
  console.log('PENDING:', order.id);
}
main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
