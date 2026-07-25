CREATE TABLE `qualification_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`source_stage_id` text NOT NULL,
	`target_stage_id` text NOT NULL,
	`top_per_group` integer NOT NULL,
	`best_additional_entries` integer DEFAULT 0 NOT NULL,
	`ranking_criteria_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`source_stage_id`) REFERENCES `stages`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`target_stage_id`) REFERENCES `stages`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `schedule_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`stage_id` text,
	`default_match_duration_minutes` integer NOT NULL,
	`minimum_rest_minutes` integer NOT NULL,
	`court_change_buffer_minutes` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `tournament_events`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`stage_id`) REFERENCES `stages`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `standing_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`name` text NOT NULL,
	`criteria_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `tournament_events`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`stage_id` text NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`order_index` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`stage_id`) REFERENCES `stages`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `groups_stage_code_uidx` ON `groups` (`stage_id`,`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `groups_stage_order_uidx` ON `groups` (`stage_id`,`order_index`);--> statement-breakpoint
CREATE TABLE `draw_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`stage_id` text NOT NULL,
	`random_seed` text NOT NULL,
	`configuration_snapshot_json` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`created_by` text,
	`created_at` text NOT NULL,
	`confirmed_at` text,
	FOREIGN KEY (`event_id`) REFERENCES `tournament_events`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`stage_id`) REFERENCES `stages`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `draw_results` (
	`draw_session_id` text NOT NULL,
	`group_id` text NOT NULL,
	`entry_id` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`draw_session_id`, `entry_id`),
	FOREIGN KEY (`draw_session_id`) REFERENCES `draw_sessions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `draw_results_session_group_position_uidx` ON `draw_results` (`draw_session_id`,`group_id`,`position`);--> statement-breakpoint
CREATE TABLE `group_entries` (
	`group_id` text NOT NULL,
	`entry_id` text NOT NULL,
	`position` integer NOT NULL,
	`seed_position` integer,
	PRIMARY KEY(`group_id`, `entry_id`),
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `group_entries_group_position_uidx` ON `group_entries` (`group_id`,`position`);--> statement-breakpoint
CREATE TABLE `matches` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`stage_id` text NOT NULL,
	`group_id` text,
	`round_number` integer NOT NULL,
	`bracket_position` integer,
	`entry_a_id` text,
	`entry_b_id` text,
	`winner_entry_id` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`resolution` text,
	`rule_snapshot_json` text NOT NULL,
	`generation_key` text,
	`court_id` text,
	`scheduled_at` text,
	`estimated_duration_minutes` integer,
	`started_at` text,
	`completed_at` text,
	`next_match_id` text,
	`next_match_slot` text,
	`loser_next_match_id` text,
	`loser_next_match_slot` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `tournament_events`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`stage_id`) REFERENCES `stages`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`entry_a_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`entry_b_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`winner_entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`court_id`) REFERENCES `courts`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `matches_generation_key_uidx` ON `matches` (`generation_key`);--> statement-breakpoint
CREATE INDEX `matches_event_idx` ON `matches` (`event_id`);--> statement-breakpoint
CREATE INDEX `matches_stage_idx` ON `matches` (`stage_id`);--> statement-breakpoint
CREATE INDEX `matches_group_idx` ON `matches` (`group_id`);--> statement-breakpoint
CREATE TABLE `match_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`set_number` integer NOT NULL,
	`score_a` integer DEFAULT 0 NOT NULL,
	`score_b` integer DEFAULT 0 NOT NULL,
	`winner_entry_id` text,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`winner_entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `match_sets_match_set_number_uidx` ON `match_sets` (`match_id`,`set_number`);
