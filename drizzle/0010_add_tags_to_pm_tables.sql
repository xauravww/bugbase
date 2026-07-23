ALTER TABLE `requirements` ADD COLUMN `tags` text;
--> statement-breakpoint
ALTER TABLE `features` ADD COLUMN `tags` text;
--> statement-breakpoint
ALTER TABLE `bugs` ADD COLUMN `tags` text;
