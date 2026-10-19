import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;
const existingPrisma = globalForPrisma.prisma;
const prisma = existingPrisma && existingPrisma.role ? existingPrisma : new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
