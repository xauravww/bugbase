CREATE TABLE `context_activity` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`entry_id` integer,
	`user_id` integer NOT NULL,
	`action` text NOT NULL,
	`old_value` text,
	`new_value` text,
	`created_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entry_id`) REFERENCES `context_entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_context_activity_project` ON `context_activity` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_context_activity_entry` ON `context_activity` (`entry_id`);--> statement-breakpoint
CREATE INDEX `idx_context_activity_created_at` ON `context_activity` (`created_at`);--> statement-breakpoint
CREATE TABLE `context_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`kind` text NOT NULL,
	`parent_id` integer,
	`title` text,
	`body` text NOT NULL,
	`source` text DEFAULT 'user' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`pinned` integer DEFAULT false NOT NULL,
	`metadata` text,
	`created_by` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_context_entries_project` ON `context_entries` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_context_entries_kind` ON `context_entries` (`kind`);--> statement-breakpoint
CREATE INDEX `idx_context_entries_status` ON `context_entries` (`status`);--> statement-breakpoint
CREATE INDEX `idx_context_entries_parent` ON `context_entries` (`parent_id`);--> statement-breakpoint
CREATE INDEX `idx_context_entries_updated_at` ON `context_entries` (`updated_at`);--> statement-breakpoint
CREATE TABLE `context_entry_embeddings` (
	`entry_id` integer PRIMARY KEY NOT NULL,
	`model` text NOT NULL,
	`dim` integer NOT NULL,
	`vector` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`entry_id`) REFERENCES `context_entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `treemap_paths` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`path` text NOT NULL,
	`tested` integer DEFAULT false NOT NULL,
	`notes` text,
	`last_tested_at` integer,
	`updated_by` integer,
	`updated_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_treemap_paths_project_path` ON `treemap_paths` (`project_id`,`path`);--> statement-breakpoint
ALTER TABLE `issues` ADD `is_verified` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_issues_verified` ON `issues` (`is_verified`);