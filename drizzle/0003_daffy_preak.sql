CREATE TABLE `test_case_embeddings` (
	`test_case_id` integer PRIMARY KEY NOT NULL,
	`model` text NOT NULL,
	`dim` integer NOT NULL,
	`vector` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`test_case_id`) REFERENCES `test_cases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `test_case_results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`test_case_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`status` text NOT NULL,
	`notes` text,
	`created_at` integer,
	FOREIGN KEY (`test_case_id`) REFERENCES `test_cases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_test_case_results_test_case` ON `test_case_results` (`test_case_id`);--> statement-breakpoint
CREATE TABLE `test_cases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`steps` text,
	`expected_result` text,
	`category_id` integer,
	`created_by` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_test_cases_project` ON `test_cases` (`project_id`);