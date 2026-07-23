CREATE TABLE `clients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`contact_email` text,
	`notes` text,
	`created_by` integer NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `requirements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`type` text DEFAULT 'Feature' NOT NULL,
	`priority` text DEFAULT 'Medium' NOT NULL,
	`status` text DEFAULT 'Draft' NOT NULL,
	`acceptance_criteria` text,
	`parent_id` integer,
	`created_by` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_requirements_project` ON `requirements` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_requirements_status` ON `requirements` (`status`);--> statement-breakpoint
CREATE INDEX `idx_requirements_parent` ON `requirements` (`parent_id`);--> statement-breakpoint
CREATE TABLE `features` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'Proposed' NOT NULL,
	`priority` text DEFAULT 'Medium' NOT NULL,
	`requirement_id` integer,
	`epic` text,
	`story_points` integer,
	`created_by` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_features_project` ON `features` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_features_status` ON `features` (`status`);--> statement-breakpoint
CREATE INDEX `idx_features_requirement` ON `features` (`requirement_id`);--> statement-breakpoint
CREATE TABLE `dev_tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'Todo' NOT NULL,
	`priority` text DEFAULT 'Medium' NOT NULL,
	`assignee_id` integer,
	`due_date` integer,
	`estimated_time` real,
	`actual_time` real,
	`feature_id` integer,
	`requirement_id` integer,
	`sprint_id` integer,
	`created_by` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_dev_tasks_project` ON `dev_tasks` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_dev_tasks_status` ON `dev_tasks` (`status`);--> statement-breakpoint
CREATE INDEX `idx_dev_tasks_assignee` ON `dev_tasks` (`assignee_id`);--> statement-breakpoint
CREATE INDEX `idx_dev_tasks_sprint` ON `dev_tasks` (`sprint_id`);--> statement-breakpoint
CREATE TABLE `bugs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`severity` text DEFAULT 'Medium' NOT NULL,
	`status` text DEFAULT 'Open' NOT NULL,
	`environment` text DEFAULT 'Dev' NOT NULL,
	`steps_to_reproduce` text,
	`expected_result` text,
	`actual_result` text,
	`task_id` integer,
	`created_by` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_bugs_project` ON `bugs` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_bugs_status` ON `bugs` (`status`);--> statement-breakpoint
CREATE INDEX `idx_bugs_severity` ON `bugs` (`severity`);--> statement-breakpoint
CREATE TABLE `releases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`version` text NOT NULL,
	`release_date` integer,
	`status` text DEFAULT 'Planned' NOT NULL,
	`release_notes` text,
	`created_by` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_releases_project` ON `releases` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_releases_status` ON `releases` (`status`);--> statement-breakpoint
CREATE TABLE `api_docs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`endpoint` text NOT NULL,
	`http_method` text DEFAULT 'GET' NOT NULL,
	`authentication` text DEFAULT 'None' NOT NULL,
	`request_body` text,
	`response_body` text,
	`status` text DEFAULT 'Draft' NOT NULL,
	`created_by` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_api_docs_project` ON `api_docs` (`project_id`);--> statement-breakpoint
CREATE TABLE `arch_docs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`title` text NOT NULL,
	`category` text DEFAULT 'Architecture' NOT NULL,
	`content` text,
	`created_by` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_arch_docs_project` ON `arch_docs` (`project_id`);--> statement-breakpoint
CREATE TABLE `meeting_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`title` text NOT NULL,
	`meeting_date` integer,
	`participants` text,
	`summary` text,
	`decisions` text,
	`action_items` text,
	`created_by` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_meeting_notes_project` ON `meeting_notes` (`project_id`);--> statement-breakpoint
CREATE TABLE `risks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`impact` text DEFAULT 'Medium' NOT NULL,
	`probability` text DEFAULT 'Medium' NOT NULL,
	`mitigation_plan` text,
	`status` text DEFAULT 'Open' NOT NULL,
	`created_by` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_risks_project` ON `risks` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_risks_status` ON `risks` (`status`);--> statement-breakpoint
CREATE TABLE `ideas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`impact` integer DEFAULT 3 NOT NULL,
	`effort` integer DEFAULT 3 NOT NULL,
	`priority` text DEFAULT 'Medium' NOT NULL,
	`status` text DEFAULT 'New' NOT NULL,
	`created_by` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_ideas_project` ON `ideas` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_ideas_status` ON `ideas` (`status`);--> statement-breakpoint
CREATE TABLE `milestones` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`name` text NOT NULL,
	`target_date` integer,
	`status` text DEFAULT 'Upcoming' NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`created_by` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_milestones_project` ON `milestones` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_milestones_status` ON `milestones` (`status`);--> statement-breakpoint
CREATE TABLE `sprints` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`name` text NOT NULL,
	`start_date` integer,
	`end_date` integer,
	`goal` text,
	`status` text DEFAULT 'Planned' NOT NULL,
	`created_by` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_sprints_project` ON `sprints` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_sprints_status` ON `sprints` (`status`);--> statement-breakpoint
CREATE TABLE `release_features` (
	`release_id` integer NOT NULL,
	`feature_id` integer NOT NULL,
	PRIMARY KEY(`release_id`, `feature_id`),
	FOREIGN KEY (`release_id`) REFERENCES `releases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`feature_id`) REFERENCES `features`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `release_bugs` (
	`release_id` integer NOT NULL,
	`bug_id` integer NOT NULL,
	PRIMARY KEY(`release_id`, `bug_id`),
	FOREIGN KEY (`release_id`) REFERENCES `releases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bug_id`) REFERENCES `bugs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `dev_task_deps` (
	`task_id` integer NOT NULL,
	`depends_on_id` integer NOT NULL,
	PRIMARY KEY(`task_id`, `depends_on_id`),
	FOREIGN KEY (`task_id`) REFERENCES `dev_tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`depends_on_id`) REFERENCES `dev_tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `pm_activity` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`module` text NOT NULL,
	`entity_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`action` text NOT NULL,
	`detail` text,
	`created_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_pm_activity_project` ON `pm_activity` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_pm_activity_created_at` ON `pm_activity` (`created_at`);
