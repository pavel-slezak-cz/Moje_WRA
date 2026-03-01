-- DropForeignKey
ALTER TABLE `response_items` DROP FOREIGN KEY `response_items_response_id_fkey`;

-- AlterTable
ALTER TABLE `construct_scores` ADD COLUMN `normalized_gap_mean` DOUBLE NULL,
    ADD COLUMN `normalized_source_mean` DOUBLE NULL,
    ADD COLUMN `normalized_target_mean` DOUBLE NULL;

-- AlterTable
ALTER TABLE `global_scores` ADD COLUMN `normalized_global_gap_mean` DOUBLE NULL,
    ADD COLUMN `normalized_global_source_mean` DOUBLE NULL,
    ADD COLUMN `normalized_global_target_mean` DOUBLE NULL;

-- AlterTable
ALTER TABLE `item_scores` ADD COLUMN `normalized_gap` DOUBLE NULL,
    ADD COLUMN `normalized_source` DOUBLE NULL,
    ADD COLUMN `normalized_target` DOUBLE NULL;

-- AlterTable
ALTER TABLE `items` ADD COLUMN `label_set` ENUM('AGREEMENT', 'FREQUENCY', 'QUALITY', 'IMPORTANCE') NULL,
    MODIFY `scale_type` ENUM('LIKERT_5', 'LIKERT_7', 'TEXT', 'YES_NO', 'SCALE_3', 'SCALE_6', 'SCALE_10') NOT NULL DEFAULT 'LIKERT_5';

-- AddForeignKey
ALTER TABLE `response_items` ADD CONSTRAINT `response_items_response_id_fkey` FOREIGN KEY (`response_id`) REFERENCES `instrument_responses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
