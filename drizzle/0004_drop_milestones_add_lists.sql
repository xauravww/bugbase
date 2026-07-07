-- Drop milestone tables
DROP TABLE IF EXISTS `milestone_notes`;
--> statement-breakpoint
DROP TABLE IF EXISTS `milestone_checklist_completions`;
--> statement-breakpoint
DROP TABLE IF EXISTS `milestone_checklist_items`;
--> statement-breakpoint
DROP TABLE IF EXISTS `milestones`;
--> statement-breakpoint

-- Create lists (TickTick-style task hierarchy)
CREATE TABLE `lists` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`color` text DEFAULT '#5b76fe' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_by` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_lists_project` ON `lists` (`project_id`);
--> statement-breakpoint
CREATE INDEX `idx_lists_sort` ON `lists` (`project_id`, `sort_order`);
--> statement-breakpoint

CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`list_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'active' NOT NULL,
	`priority` text DEFAULT 'none' NOT NULL,
	`completed_at` integer,
	`completed_by` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`due_date` integer,
	`created_by` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`completed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_tasks_list` ON `tasks` (`list_id`);
--> statement-breakpoint
CREATE INDEX `idx_tasks_status` ON `tasks` (`status`);
--> statement-breakpoint
CREATE INDEX `idx_tasks_list_sort` ON `tasks` (`list_id`, `sort_order`);
--> statement-breakpoint

CREATE TABLE `subtasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'active' NOT NULL,
	`completed_at` integer,
	`completed_by` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`completed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_subtasks_task` ON `subtasks` (`task_id`);
--> statement-breakpoint
CREATE INDEX `idx_subtasks_task_sort` ON `subtasks` (`task_id`, `sort_order`);
--> statement-breakpoint

CREATE TABLE `checklist_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subtask_id` integer NOT NULL,
	`content` text NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`subtask_id`) REFERENCES `subtasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_checklist_items_subtask` ON `checklist_items` (`subtask_id`);
--> statement-breakpoint

CREATE TABLE `task_activity` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`task_id` integer,
	`subtask_id` integer,
	`user_id` integer NOT NULL,
	`action` text NOT NULL,
	`old_value` text,
	`new_value` text,
	`created_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subtask_id`) REFERENCES `subtasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_task_activity_project` ON `task_activity` (`project_id`);
--> statement-breakpoint
CREATE INDEX `idx_task_activity_task` ON `task_activity` (`task_id`);
--> statement-breakpoint
CREATE INDEX `idx_task_activity_created_at` ON `task_activity` (`created_at`);
