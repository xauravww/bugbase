CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#5b76fe' NOT NULL,
	`created_by` integer NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_categories_project` ON `categories` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_categories_project_name` ON `categories` (`project_id`,`name`);--> statement-breakpoint
CREATE TABLE `issue_categories` (
	`issue_id` integer NOT NULL,
	`category_id` integer NOT NULL,
	PRIMARY KEY(`issue_id`, `category_id`),
	FOREIGN KEY (`issue_id`) REFERENCES `issues`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_issue_categories_category` ON `issue_categories` (`category_id`);