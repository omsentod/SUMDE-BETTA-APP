-- ==============================================================================
-- SUMDE-BETTA Migration: ChatMessage Edit & Soft-Delete Columns
-- Commit: feaa371bd9484f0a36704a8728e2cb1c689aea79
-- Target Database: Hostinger MySQL (u707667165_sumdebetta)
--
-- Jalankan query ini langsung di menu SQL pada phpMyAdmin Hostinger
-- atau via terminal SSH:
-- mysql -u [user] -p [database_name] < prisma/migrations/20261113_add_chat_message_edit_delete.sql
-- ==============================================================================

-- 1. Tambah 4 kolom baru pada tabel ChatMessage
ALTER TABLE `ChatMessage`
  ADD COLUMN `isEdited` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `editedAt` DATETIME(3) NULL,
  ADD COLUMN `deletedAt` DATETIME(3) NULL;
