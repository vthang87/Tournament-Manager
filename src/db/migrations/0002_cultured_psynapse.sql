PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_qualification_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`source_stage_id` text NOT NULL,
	`target_stage_id` text NOT NULL,
	`top_per_group` integer NOT NULL,
	`best_additional_entries` integer DEFAULT 0 NOT NULL,
	`additional_from_rank` integer,
	`ranking_criteria_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`source_stage_id`) REFERENCES `stages`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`target_stage_id`) REFERENCES `stages`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_qualification_rules`("id", "source_stage_id", "target_stage_id", "top_per_group", "best_additional_entries", "ranking_criteria_json", "created_at", "updated_at") SELECT "id", "source_stage_id", "target_stage_id", "top_per_group", "best_additional_entries", "ranking_criteria_json", "created_at", "updated_at" FROM `qualification_rules`;--> statement-breakpoint
DROP TABLE `qualification_rules`;--> statement-breakpoint
ALTER TABLE `__new_qualification_rules` RENAME TO `qualification_rules`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_schedule_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`stage_id` text,
	`default_match_duration_minutes` integer DEFAULT 45 NOT NULL,
	`minimum_rest_minutes` integer DEFAULT 15 NOT NULL,
	`court_change_buffer_minutes` integer DEFAULT 5 NOT NULL,
	`hard_rest_conflicts` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `tournament_events`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`stage_id`) REFERENCES `stages`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_schedule_rules`("id", "event_id", "stage_id", "default_match_duration_minutes", "minimum_rest_minutes", "court_change_buffer_minutes", "created_at", "updated_at") SELECT "id", "event_id", "stage_id", "default_match_duration_minutes", "minimum_rest_minutes", "court_change_buffer_minutes", "created_at", "updated_at" FROM `schedule_rules`;--> statement-breakpoint
DROP TABLE `schedule_rules`;--> statement-breakpoint
ALTER TABLE `__new_schedule_rules` RENAME TO `schedule_rules`;--> statement-breakpoint
ALTER TABLE `standing_rules` ADD `special_policy_json` text;--> statement-breakpoint
ALTER TABLE `matches` ADD `is_third_place` integer DEFAULT false NOT NULL;
