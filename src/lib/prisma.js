import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

// Selalu simpan di globalThis agar baik di development maupun di production (terutama
// di arsitektur chunked Next.js / Hostinger Node.js), hanya ada 1 instance
// PrismaClient tunggal (singleton). Ini mencegah kebocoran / ledakan koneksi MySQL ("max_user_connections").
const existingPrisma = globalForPrisma.prisma;
const isFreshPrisma = existingPrisma &&
  existingPrisma.department &&
  existingPrisma.subCategory &&
  existingPrisma.conversation &&
  existingPrisma.chatTemplate &&
  existingPrisma.chatMessage &&
  existingPrisma.chatSetting &&
  existingPrisma._runtimeDataModel?.models?.ChatSetting?.fields?.some((f) => f.name === 'adminLastActiveAt') &&
  existingPrisma._runtimeDataModel?.models?.ChatTemplate?.fields?.some((f) => f.name === 'answerText') &&
  existingPrisma._runtimeDataModel?.models?.Product?.fields?.some((f) => f.name === 'isWholesale') &&
  existingPrisma._runtimeDataModel?.models?.TikTokLiveBasket?.fields?.some((f) => f.name === 'claimToken') &&
  existingPrisma._runtimeDataModel?.models?.TikTokAccount?.fields?.some((f) => f.name === 'avatar');

const prisma = isFreshPrisma ? existingPrisma : new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

globalForPrisma.prisma = prisma;

export default prisma;

