import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

// Selalu simpan di globalThis agar baik di development maupun di production (terutama
// di arsitektur chunked Next.js / Hostinger Node.js), hanya ada 1 instance
// PrismaClient tunggal (singleton). Ini mencegah kebocoran / ledakan koneksi MySQL ("max_user_connections").
const existingPrisma = globalForPrisma.prisma;
const prisma = existingPrisma && existingPrisma.role ? existingPrisma : new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

globalForPrisma.prisma = prisma;

export default prisma;

