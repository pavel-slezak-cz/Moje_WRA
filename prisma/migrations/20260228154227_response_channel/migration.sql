/*
  Warnings:

  - A unique constraint covering the columns `[response_id,item_id,channel]` on the table `response_items` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `response_items` DROP FOREIGN KEY `response_items_response_id_fkey`;

-- DropIndex
DROP INDEX `response_items_response_id_item_id_key` ON `response_items`;

-- AlterTable
ALTER TABLE `response_items` ADD COLUMN `channel` ENUM('SOURCE', 'TARGET') NOT NULL DEFAULT 'SOURCE';

-- CreateIndex
CREATE UNIQUE INDEX `response_items_response_id_item_id_channel_key` ON `response_items`(`response_id`, `item_id`, `channel`);

