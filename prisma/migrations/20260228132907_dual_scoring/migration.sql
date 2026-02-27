/*
  Warnings:

  - You are about to alter the column `gap_value` on the `item_scores` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Double`.

*/
-- AlterTable
ALTER TABLE `construct_scores` ADD COLUMN `mean_absolute_gap` DOUBLE NULL;

-- AlterTable
ALTER TABLE `global_scores` ADD COLUMN `global_mean_absolute_gap` DOUBLE NULL;

-- AlterTable
ALTER TABLE `instrument_versions` ADD COLUMN `scoring_strategy` ENUM('WRA_ABSOLUTE_GAP', 'NORMATIVE_360') NOT NULL DEFAULT 'WRA_ABSOLUTE_GAP';

-- AlterTable
ALTER TABLE `item_scores` ADD COLUMN `absolute_gap_value` DOUBLE NULL,
    MODIFY `gap_value` DOUBLE NULL;

-- AlterTable
ALTER TABLE `items` ADD COLUMN `behavior_polarity` ENUM('POSITIVE', 'NEGATIVE') NULL;
