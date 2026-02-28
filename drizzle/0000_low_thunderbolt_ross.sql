CREATE TABLE `activity_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`issue_id` integer,
	`user_id` integer NOT NULL,
	`action` text NOT NULL,
	`old_value` text,
	`new_value` text,
	`created_at` integer,
	FOREIGN KEY (`issue_id`) REFERENCES `issues`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_activity_log_issue` ON `activity_log` (`issue_id`);--> statement-breakpoint
CREATE INDEX `idx_activity_log_user` ON `activity_log` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_activity_log_created_at` ON `activity_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `attachments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`issue_id` integer,
	`comment_id` integer,
	`url` text NOT NULL,
	`imgbb_delete_hash` text,
	`uploaded_by` integer NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`issue_id`) REFERENCES `issues`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`comment_id`) REFERENCES `comments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_attachments_issue` ON `attachments` (`issue_id`);--> statement-breakpoint
CREATE INDEX `idx_attachments_comment` ON `attachments` (`comment_id`);--> statement-breakpoint
CREATE TABLE `comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`issue_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`body` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`issue_id`) REFERENCES `issues`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_comments_issue` ON `comments` (`issue_id`);--> statement-breakpoint
CREATE INDEX `idx_comments_user` ON `comments` (`user_id`);--> statement-breakpoint
CREATE TABLE `email_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_templates_event_unique` ON `email_templates` (`event`);--> statement-breakpoint
CREATE TABLE `issue_assignees` (
	`issue_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	PRIMARY KEY(`issue_id`, `user_id`),
	FOREIGN KEY (`issue_id`) REFERENCES `issues`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `issue_verifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`issue_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`verified_at` integer,
	FOREIGN KEY (`issue_id`) REFERENCES `issues`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `issue_verifiers` (
	`issue_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	PRIMARY KEY(`issue_id`, `user_id`),
	FOREIGN KEY (`issue_id`) REFERENCES `issues`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `issues` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`title` text NOT NULL,
	`type` text DEFAULT 'Bug' NOT NULL,
	`description` text,
	`steps_to_reproduce` text,
	`expected_result` text,
	`actual_result` text,
	`status` text DEFAULT 'Open' NOT NULL,
	`priority` text DEFAULT 'Medium' NOT NULL,
	`reporter_id` integer NOT NULL,
	`start_date` integer,
	`due_date` integer,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_issues_project` ON `issues` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_issues_status` ON `issues` (`status`);--> statement-breakpoint
CREATE INDEX `idx_issues_reporter` ON `issues` (`reporter_id`);--> statement-breakpoint
CREATE INDEX `idx_issues_created_at` ON `issues` (`created_at`);--> statement-breakpoint
CREATE TABLE `milestone_checklist_completions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`checklist_item_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`notes` text,
	`completed_at` integer,
	FOREIGN KEY (`checklist_item_id`) REFERENCES `milestone_checklist_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_completions_item` ON `milestone_checklist_completions` (`checklist_item_id`);--> statement-breakpoint
CREATE INDEX `idx_completions_user` ON `milestone_checklist_completions` (`user_id`);--> statement-breakpoint
CREATE TABLE `milestone_checklist_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`milestone_id` integer NOT NULL,
	`content` text NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`milestone_id`) REFERENCES `milestones`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_checklist_milestone` ON `milestone_checklist_items` (`milestone_id`);--> statement-breakpoint
CREATE TABLE `milestone_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`milestone_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`content` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`milestone_id`) REFERENCES `milestones`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_notes_milestone` ON `milestone_notes` (`milestone_id`);--> statement-breakpoint
CREATE INDEX `idx_notes_user` ON `milestone_notes` (`user_id`);--> statement-breakpoint
CREATE TABLE `milestones` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'Not Started' NOT NULL,
	`created_by` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_milestones_project` ON `milestones` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_milestones_status` ON `milestones` (`status`);--> statement-breakpoint
CREATE TABLE `project_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_project_members_project_user` ON `project_members` (`project_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_project_members_user` ON `project_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`key` text NOT NULL,
	`description` text,
	`start_date` integer,
	`end_date` integer,
	`created_by` integer NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_key_unique` ON `projects` (`key`);--> statement-breakpoint
CREATE INDEX `idx_projects_key` ON `projects` (`key`);--> statement-breakpoint
CREATE INDEX `idx_projects_created_by` ON `projects` (`created_by`);--> statement-breakpoint
CREATE INDEX `idx_projects_archived` ON `projects` (`archived`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'Developer' NOT NULL,
	`created_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_users_email` ON `users` (`email`);