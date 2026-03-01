/*
  Warnings:

  - A unique constraint covering the columns `[assignment_id]` on the table `instrument_responses` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `instrument_responses` ADD COLUMN `assignment_id` INTEGER NULL;

-- CreateTable
CREATE TABLE `evaluation_assignments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `project_id` INTEGER NOT NULL,
    `evaluator_user_id` INTEGER NOT NULL,
    `target_user_id` INTEGER NOT NULL,
    `relationship` ENUM('SELF', 'MANAGER', 'PEER', 'SUBORDINATE') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `evaluation_assignments_project_id_evaluator_user_id_target_u_key`(`project_id`, `evaluator_user_id`, `target_user_id`, `relationship`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `instrument_responses_assignment_id_key` ON `instrument_responses`(`assignment_id`);

-- AddForeignKey
ALTER TABLE `instrument_responses` ADD CONSTRAINT `instrument_responses_assignment_id_fkey` FOREIGN KEY (`assignment_id`) REFERENCES `evaluation_assignments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `evaluation_assignments` ADD CONSTRAINT `evaluation_assignments_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `evaluation_assignments` ADD CONSTRAINT `evaluation_assignments_evaluator_user_id_fkey` FOREIGN KEY (`evaluator_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `evaluation_assignments` ADD CONSTRAINT `evaluation_assignments_target_user_id_fkey` FOREIGN KEY (`target_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
