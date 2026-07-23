ALTER TABLE `issues` ADD `is_verified` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_issues_verified` ON `issues` (`is_verified`);