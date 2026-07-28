CREATE TABLE `work_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
	`project_id` integer REFERENCES `projects`(`id`) ON DELETE CASCADE,
	`log_date` integer NOT NULL,
	`content` text NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_work_logs_user` ON `work_logs` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_work_logs_project` ON `work_logs` (`project_id`);
--> statement-breakpoint
CREATE INDEX `idx_work_logs_date` ON `work_logs` (`log_date`);
--> statement-breakpoint
CREATE INDEX `idx_work_logs_user_date` ON `work_logs` (`user_id`, `log_date`);
