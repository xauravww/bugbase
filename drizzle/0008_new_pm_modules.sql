CREATE TABLE `user_stories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'Draft' NOT NULL,
	`priority` text DEFAULT 'Medium' NOT NULL,
	`role` text,
	`goal` text,
	`benefit` text,
	`acceptance_criteria` text,
	`requirement_id` integer,
	`created_by` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_user_stories_project` ON `user_stories` (`project_id`);
--> statement-breakpoint
CREATE INDEX `idx_user_stories_status` ON `user_stories` (`status`);
--> statement-breakpoint
CREATE TABLE `personas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`name` text NOT NULL,
	`role` text,
	`status` text DEFAULT 'Draft' NOT NULL,
	`goals` text,
	`pain_points` text,
	`behaviors` text,
	`created_by` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_personas_project` ON `personas` (`project_id`);
--> statement-breakpoint
CREATE INDEX `idx_personas_status` ON `personas` (`status`);
--> statement-breakpoint
CREATE TABLE `user_journeys` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`title` text NOT NULL,
	`stage` text DEFAULT 'Awareness' NOT NULL,
	`status` text DEFAULT 'Draft' NOT NULL,
	`persona` text,
	`description` text,
	`touchpoints` text,
	`pain_points` text,
	`opportunities` text,
	`created_by` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_user_journeys_project` ON `user_journeys` (`project_id`);
--> statement-breakpoint
CREATE INDEX `idx_user_journeys_status` ON `user_journeys` (`status`);
--> statement-breakpoint
CREATE TABLE `tech_stack` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`name` text NOT NULL,
	`category` text DEFAULT 'Backend' NOT NULL,
	`status` text DEFAULT 'Evaluating' NOT NULL,
	`version` text,
	`description` text,
	`rationale` text,
	`created_by` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_tech_stack_project` ON `tech_stack` (`project_id`);
--> statement-breakpoint
CREATE INDEX `idx_tech_stack_status` ON `tech_stack` (`status`);
--> statement-breakpoint
CREATE TABLE `mockups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`title` text NOT NULL,
	`screen` text,
	`status` text DEFAULT 'Draft' NOT NULL,
	`url` text,
	`description` text,
	`created_by` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_mockups_project` ON `mockups` (`project_id`);
--> statement-breakpoint
CREATE INDEX `idx_mockups_status` ON `mockups` (`status`);
--> statement-breakpoint
CREATE TABLE `workflows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'Draft' NOT NULL,
	`trigger` text,
	`description` text,
	`steps` text,
	`created_by` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_workflows_project` ON `workflows` (`project_id`);
--> statement-breakpoint
CREATE INDEX `idx_workflows_status` ON `workflows` (`status`);
--> statement-breakpoint
CREATE TABLE `business_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`title` text NOT NULL,
	`category` text DEFAULT 'Validation' NOT NULL,
	`status` text DEFAULT 'Draft' NOT NULL,
	`description` text,
	`condition` text,
	`action` text,
	`created_by` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_business_rules_project` ON `business_rules` (`project_id`);
--> statement-breakpoint
CREATE INDEX `idx_business_rules_status` ON `business_rules` (`status`);
