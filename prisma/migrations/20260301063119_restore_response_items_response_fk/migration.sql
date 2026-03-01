-- AddForeignKey
ALTER TABLE `response_items` ADD CONSTRAINT `response_items_response_id_fkey` FOREIGN KEY (`response_id`) REFERENCES `instrument_responses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
