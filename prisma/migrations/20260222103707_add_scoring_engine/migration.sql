-- AlterTable
ALTER TABLE `items` ADD COLUMN `gap_group_id` VARCHAR(191) NULL,
    ADD COLUMN `measurement_type` ENUM('SOURCE', 'TARGET') NOT NULL DEFAULT 'SOURCE';

-- CreateTable
CREATE TABLE `item_scores` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `response_id` INTEGER NOT NULL,
    `item_id` INTEGER NOT NULL,
    `source_value` INTEGER NULL,
    `target_value` INTEGER NULL,
    `gap_value` INTEGER NULL,

    UNIQUE INDEX `item_scores_response_id_item_id_key`(`response_id`, `item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `construct_scores` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `response_id` INTEGER NOT NULL,
    `construct_id` INTEGER NOT NULL,
    `source_mean` DOUBLE NULL,
    `target_mean` DOUBLE NULL,
    `gap_mean` DOUBLE NULL,
    `scoring_model_version` VARCHAR(191) NOT NULL DEFAULT '1.0',
    `computed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `construct_scores_response_id_construct_id_key`(`response_id`, `construct_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `global_scores` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `response_id` INTEGER NOT NULL,
    `global_source_mean` DOUBLE NULL,
    `global_target_mean` DOUBLE NULL,
    `global_gap_mean` DOUBLE NULL,
    `scoring_model_version` VARCHAR(191) NOT NULL DEFAULT '1.0',
    `computed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `global_scores_response_id_key`(`response_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `item_scores` ADD CONSTRAINT `item_scores_response_id_fkey` FOREIGN KEY (`response_id`) REFERENCES `instrument_responses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_scores` ADD CONSTRAINT `item_scores_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `construct_scores` ADD CONSTRAINT `construct_scores_response_id_fkey` FOREIGN KEY (`response_id`) REFERENCES `instrument_responses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `construct_scores` ADD CONSTRAINT `construct_scores_construct_id_fkey` FOREIGN KEY (`construct_id`) REFERENCES `constructs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `global_scores` ADD CONSTRAINT `global_scores_response_id_fkey` FOREIGN KEY (`response_id`) REFERENCES `instrument_responses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
