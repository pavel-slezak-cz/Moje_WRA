-- AlterTable
ALTER TABLE `users` ADD COLUMN `role` ENUM('SUPERUSER', 'STAFF', 'RESPONDENT') NOT NULL DEFAULT 'RESPONDENT';

-- CreateTable
CREATE TABLE `project_staff_access` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `project_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `project_staff_access_project_id_idx`(`project_id`),
    INDEX `project_staff_access_user_id_idx`(`user_id`),
    UNIQUE INDEX `project_staff_access_user_id_project_id_key`(`user_id`, `project_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `project_staff_access` ADD CONSTRAINT `project_staff_access_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_staff_access` ADD CONSTRAINT `project_staff_access_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
