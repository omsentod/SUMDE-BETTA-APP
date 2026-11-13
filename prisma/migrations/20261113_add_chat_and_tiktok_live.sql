-- SUMDE-BETTA Migration: Live Chat & TikTok Live Commerce
-- Dijalankan pada database Hostinger MySQL (u707667165_sumdebetta)

-- 1. Tambah kolom baru pada User (Avatar & Verifikasi Nomor Telepon)
ALTER TABLE `User` 
  ADD COLUMN `avatarUrl` TEXT NULL,
  ADD COLUMN `phoneVerified` DATETIME(3) NULL;

-- 2. Tambah kolom baru pada Role (Warna Badge Granular)
ALTER TABLE `Role` 
  ADD COLUMN `color` VARCHAR(191) NULL DEFAULT '#3B82F6';

-- 3. Tambah kolom baru pada Order (Sumber Order, TikTok Username & Channel)
ALTER TABLE `Order` 
  ADD COLUMN `orderSource` VARCHAR(191) NOT NULL DEFAULT 'WEB',
  ADD COLUMN `tiktokAccountName` VARCHAR(191) NULL,
  ADD COLUMN `tiktokUsername` VARCHAR(191) NULL;

CREATE INDEX `Order_orderSource_idx` ON `Order`(`orderSource`);

-- 4. Modifikasi OrderItem agar mendukung item kustom TikTok Live (productId nullable)
ALTER TABLE `OrderItem` 
  ADD COLUMN `customImage` VARCHAR(191) NULL,
  ADD COLUMN `customName` VARCHAR(191) NULL,
  MODIFY `productId` VARCHAR(191) NULL;

-- 5. Tabel Akun TikTok
CREATE TABLE IF NOT EXISTS `TikTokAccount` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `handle` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `orderIndex` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TikTokAccount_handle_key`(`handle`),
    INDEX `TikTokAccount_orderIndex_idx`(`orderIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 6. Tabel Keranjang Live (TikTokLiveBasket)
CREATE TABLE IF NOT EXISTS `TikTokLiveBasket` (
    `id` VARCHAR(191) NOT NULL,
    `claimCode` VARCHAR(191) NOT NULL,
    `claimToken` VARCHAR(191) NULL,
    `tiktokUsername` VARCHAR(191) NOT NULL,
    `tiktokAccountId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'OPEN',
    `orderId` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TikTokLiveBasket_claimCode_key`(`claimCode`),
    UNIQUE INDEX `TikTokLiveBasket_claimToken_key`(`claimToken`),
    UNIQUE INDEX `TikTokLiveBasket_orderId_key`(`orderId`),
    INDEX `TikTokLiveBasket_tiktokUsername_status_idx`(`tiktokUsername`, `status`),
    INDEX `TikTokLiveBasket_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 7. Tabel Item Keranjang Live (TikTokLiveItem)
CREATE TABLE IF NOT EXISTS `TikTokLiveItem` (
    `id` VARCHAR(191) NOT NULL,
    `basketId` VARCHAR(191) NOT NULL,
    `tiktokAccountId` VARCHAR(191) NULL,
    `productId` VARCHAR(191) NULL,
    `variantId` VARCHAR(191) NULL,
    `selectedSize` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `price` DOUBLE NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `image` VARCHAR(191) NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TikTokLiveItem_basketId_idx`(`basketId`),
    INDEX `TikTokLiveItem_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 8. Tabel Template Chat Cepat (ChatTemplate)
CREATE TABLE IF NOT EXISTS `ChatTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `chipLabel` VARCHAR(191) NOT NULL,
    `messageText` TEXT NOT NULL,
    `answerText` TEXT NULL,
    `isAutoReply` BOOLEAN NOT NULL DEFAULT true,
    `targetPos` VARCHAR(191) NOT NULL DEFAULT 'GLOBAL',
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ChatTemplate_targetPos_isActive_idx`(`targetPos`, `isActive`),
    INDEX `ChatTemplate_sortOrder_idx`(`sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 9. Tabel Percakapan Chat (Conversation)
CREATE TABLE IF NOT EXISTS `Conversation` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `guestSessionId` VARCHAR(191) NULL,
    `guestName` VARCHAR(191) NULL,
    `guestEmail` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'OPEN',
    `unreadAdminCount` INTEGER NOT NULL DEFAULT 0,
    `unreadCustomerCount` INTEGER NOT NULL DEFAULT 0,
    `lastMessageAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Conversation_guestSessionId_key`(`guestSessionId`),
    INDEX `Conversation_userId_idx`(`userId`),
    INDEX `Conversation_guestSessionId_idx`(`guestSessionId`),
    INDEX `Conversation_lastMessageAt_idx`(`lastMessageAt`),
    INDEX `Conversation_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 10. Tabel Pesan Chat (ChatMessage)
CREATE TABLE IF NOT EXISTS `ChatMessage` (
    `id` VARCHAR(191) NOT NULL,
    `conversationId` VARCHAR(191) NOT NULL,
    `senderRole` VARCHAR(191) NOT NULL,
    `senderId` VARCHAR(191) NULL,
    `message` TEXT NOT NULL,
    `attachedType` VARCHAR(191) NULL,
    `attachedId` VARCHAR(191) NULL,
    `attachedMeta` TEXT NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ChatMessage_conversationId_idx`(`conversationId`),
    INDEX `ChatMessage_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 11. Tabel Pengaturan Jam & Status Chat (ChatSetting)
CREATE TABLE IF NOT EXISTS `ChatSetting` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'default',
    `adminStatus` VARCHAR(191) NOT NULL DEFAULT 'AUTO',
    `operatingHoursStart` VARCHAR(191) NOT NULL DEFAULT '08:00',
    `operatingHoursEnd` VARCHAR(191) NOT NULL DEFAULT '21:00',
    `offlineMessage` TEXT NOT NULL,
    `emergencyWaNumber` VARCHAR(191) NULL,
    `adminLastActiveAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 12. Foreign Key Relasi
ALTER TABLE `TikTokLiveBasket` ADD CONSTRAINT `TikTokLiveBasket_tiktokAccountId_fkey` FOREIGN KEY (`tiktokAccountId`) REFERENCES `TikTokAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `TikTokLiveBasket` ADD CONSTRAINT `TikTokLiveBasket_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `TikTokLiveItem` ADD CONSTRAINT `TikTokLiveItem_basketId_fkey` FOREIGN KEY (`basketId`) REFERENCES `TikTokLiveBasket`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `TikTokLiveItem` ADD CONSTRAINT `TikTokLiveItem_tiktokAccountId_fkey` FOREIGN KEY (`tiktokAccountId`) REFERENCES `TikTokAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `TikTokLiveItem` ADD CONSTRAINT `TikTokLiveItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Conversation` ADD CONSTRAINT `Conversation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ChatMessage` ADD CONSTRAINT `ChatMessage_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `Conversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
