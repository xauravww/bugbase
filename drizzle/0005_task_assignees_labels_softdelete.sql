-- Soft-delete columns
ALTER TABLE `lists` ADD `deleted_at` integer;
--> statement-breakpoint
ALTER TABLE `tasks` ADD `deleted_at` integer;
--> statement-breakpoint
ALTER TABLE `subtasks` ADD `deleted_at` integer;
--> statement-breakpoint
ALTER TABLE `checklist_items` ADD `deleted_at` integer;
--> statement-breakpoint
CREATE INDEX `idx_tasks_deleted` ON `tasks` (`deleted_at`);
--> statement-breakpoint
-- Task assignees (many-to-many)
CREATE TABLE `task_assignees` (
	`task_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	PRIMARY KEY(`task_id`, `user_id`),
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_task_assignees_user` ON `task_assignees` (`user_id`);
--> statement-breakpoint
-- Task completers (who marked done; supports multiple)
CREATE TABLE `task_completers` (
	`task_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`completed_at` integer,
	PRIMARY KEY(`task_id`, `user_id`),
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_task_completers_user` ON `task_completers` (`user_id`);
--> statement-breakpoint
-- Task categories (labels, reuses project categories)
CREATE TABLE `task_categories` (
	`task_id` integer NOT NULL,
	`category_id` integer NOT NULL,
	PRIMARY KEY(`task_id`, `category_id`),
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_task_categories_category` ON `task_categories` (`category_id`);
