-- Safe column rename: evaluator_user_id → respondent_user_id

-- Drop foreign keys that depend on the unique index
ALTER TABLE `evaluation_assignments` DROP FOREIGN KEY `evaluation_assignments_evaluator_user_id_fkey`;
ALTER TABLE `evaluation_assignments` DROP FOREIGN KEY `evaluation_assignments_project_id_fkey`;

-- Drop old unique constraint
DROP INDEX `evaluation_assignments_project_id_evaluator_user_id_target_u_key` ON `evaluation_assignments`;

-- Rename column
ALTER TABLE `evaluation_assignments` RENAME COLUMN `evaluator_user_id` TO `respondent_user_id`;

-- Recreate unique constraint with new column name
CREATE UNIQUE INDEX `evaluation_assignments_project_id_respondent_user_id_target__key` ON `evaluation_assignments`(`project_id`, `respondent_user_id`, `target_user_id`, `relationship`);

-- Re-add foreign keys
ALTER TABLE `evaluation_assignments` ADD CONSTRAINT `evaluation_assignments_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `evaluation_assignments` ADD CONSTRAINT `evaluation_assignments_respondent_user_id_fkey` FOREIGN KEY (`respondent_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
