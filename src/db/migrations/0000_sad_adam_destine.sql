CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"before_json" text,
	"after_json" text,
	"metadata_json" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"role" text DEFAULT 'VIEWER' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courts" (
	"id" text PRIMARY KEY NOT NULL,
	"tournament_id" text NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"access_pin_hash" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournament_events" (
	"id" text PRIMARY KEY NOT NULL,
	"tournament_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"gender_category" text NOT NULL,
	"status" text DEFAULT 'SETUP' NOT NULL,
	"default_match_rule_id" text,
	"third_place_match_enabled" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"location" text,
	"timezone" text NOT NULL,
	"start_date" text,
	"end_date" text,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"name" text NOT NULL,
	"best_of_sets" integer NOT NULL,
	"points_to_win" integer NOT NULL,
	"win_by" integer NOT NULL,
	"max_points" integer NOT NULL,
	"deuce_enabled" boolean DEFAULT true NOT NULL,
	"deciding_set_points" integer,
	"deciding_set_win_by" integer,
	"deciding_set_max_points" integer,
	"change_ends_enabled" boolean DEFAULT true NOT NULL,
	"change_ends_at" integer,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qualification_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"source_stage_id" text NOT NULL,
	"target_stage_id" text NOT NULL,
	"top_per_group" integer NOT NULL,
	"best_additional_entries" integer DEFAULT 0 NOT NULL,
	"additional_from_rank" integer,
	"ranking_criteria_json" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"stage_id" text,
	"default_match_duration_minutes" integer DEFAULT 45 NOT NULL,
	"minimum_rest_minutes" integer DEFAULT 15 NOT NULL,
	"court_change_buffer_minutes" integer DEFAULT 5 NOT NULL,
	"hard_rest_conflicts" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stage_rules" (
	"stage_id" text PRIMARY KEY NOT NULL,
	"match_rule_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stages" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"order_index" integer NOT NULL,
	"format" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "standing_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"name" text NOT NULL,
	"criteria_json" text NOT NULL,
	"special_policy_json" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clubs" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"short_name" text,
	"logo_url" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entries" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"display_name" text NOT NULL,
	"seed" integer,
	"ranking" integer,
	"club_id" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entry_members" (
	"entry_id" text NOT NULL,
	"player_id" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "entry_members_entry_id_player_id_pk" PRIMARY KEY("entry_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"gender" text DEFAULT 'UNSPECIFIED' NOT NULL,
	"date_of_birth" text,
	"phone" text,
	"email" text,
	"club_id" text,
	"ranking" integer,
	"metadata_json" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "draw_results" (
	"draw_session_id" text NOT NULL,
	"group_id" text NOT NULL,
	"entry_id" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "draw_results_draw_session_id_entry_id_pk" PRIMARY KEY("draw_session_id","entry_id")
);
--> statement-breakpoint
CREATE TABLE "draw_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"stage_id" text NOT NULL,
	"random_seed" text NOT NULL,
	"configuration_snapshot_json" text NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"created_by" text,
	"created_at" text NOT NULL,
	"confirmed_at" text
);
--> statement-breakpoint
CREATE TABLE "group_entries" (
	"group_id" text NOT NULL,
	"entry_id" text NOT NULL,
	"position" integer NOT NULL,
	"seed_position" integer,
	CONSTRAINT "group_entries_group_id_entry_id_pk" PRIMARY KEY("group_id","entry_id")
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" text PRIMARY KEY NOT NULL,
	"stage_id" text NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"order_index" integer NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_sets" (
	"id" text PRIMARY KEY NOT NULL,
	"match_id" text NOT NULL,
	"set_number" integer NOT NULL,
	"score_a" integer DEFAULT 0 NOT NULL,
	"score_b" integer DEFAULT 0 NOT NULL,
	"winner_entry_id" text
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"stage_id" text NOT NULL,
	"group_id" text,
	"round_number" integer NOT NULL,
	"bracket_position" integer,
	"entry_a_id" text,
	"entry_b_id" text,
	"winner_entry_id" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"resolution" text,
	"rule_snapshot_json" text NOT NULL,
	"generation_key" text,
	"court_id" text,
	"scheduled_at" text,
	"estimated_duration_minutes" integer,
	"warmup_until" text,
	"started_at" text,
	"completed_at" text,
	"next_match_id" text,
	"next_match_slot" text,
	"loser_next_match_id" text,
	"loser_next_match_slot" text,
	"is_third_place" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courts" ADD CONSTRAINT "courts_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_events" ADD CONSTRAINT "tournament_events_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_rules" ADD CONSTRAINT "match_rules_event_id_tournament_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."tournament_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qualification_rules" ADD CONSTRAINT "qualification_rules_source_stage_id_stages_id_fk" FOREIGN KEY ("source_stage_id") REFERENCES "public"."stages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qualification_rules" ADD CONSTRAINT "qualification_rules_target_stage_id_stages_id_fk" FOREIGN KEY ("target_stage_id") REFERENCES "public"."stages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_rules" ADD CONSTRAINT "schedule_rules_event_id_tournament_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."tournament_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_rules" ADD CONSTRAINT "schedule_rules_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_rules" ADD CONSTRAINT "stage_rules_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_rules" ADD CONSTRAINT "stage_rules_match_rule_id_match_rules_id_fk" FOREIGN KEY ("match_rule_id") REFERENCES "public"."match_rules"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stages" ADD CONSTRAINT "stages_event_id_tournament_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."tournament_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standing_rules" ADD CONSTRAINT "standing_rules_event_id_tournament_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."tournament_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_event_id_tournament_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."tournament_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_members" ADD CONSTRAINT "entry_members_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_members" ADD CONSTRAINT "entry_members_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draw_results" ADD CONSTRAINT "draw_results_draw_session_id_draw_sessions_id_fk" FOREIGN KEY ("draw_session_id") REFERENCES "public"."draw_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draw_results" ADD CONSTRAINT "draw_results_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draw_results" ADD CONSTRAINT "draw_results_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draw_sessions" ADD CONSTRAINT "draw_sessions_event_id_tournament_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."tournament_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draw_sessions" ADD CONSTRAINT "draw_sessions_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draw_sessions" ADD CONSTRAINT "draw_sessions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_entries" ADD CONSTRAINT "group_entries_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_entries" ADD CONSTRAINT "group_entries_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_sets" ADD CONSTRAINT "match_sets_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_sets" ADD CONSTRAINT "match_sets_winner_entry_id_entries_id_fk" FOREIGN KEY ("winner_entry_id") REFERENCES "public"."entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_event_id_tournament_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."tournament_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_entry_a_id_entries_id_fk" FOREIGN KEY ("entry_a_id") REFERENCES "public"."entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_entry_b_id_entries_id_fk" FOREIGN KEY ("entry_b_id") REFERENCES "public"."entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_winner_entry_id_entries_id_fk" FOREIGN KEY ("winner_entry_id") REFERENCES "public"."entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_court_id_courts_id_fk" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_uidx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "courts_tournament_code_uidx" ON "courts" USING btree ("tournament_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "tournaments_slug_uidx" ON "tournaments" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "stages_event_order_uidx" ON "stages" USING btree ("event_id","order_index");--> statement-breakpoint
CREATE UNIQUE INDEX "entry_members_entry_position_uidx" ON "entry_members" USING btree ("entry_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "draw_results_session_group_position_uidx" ON "draw_results" USING btree ("draw_session_id","group_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "group_entries_group_position_uidx" ON "group_entries" USING btree ("group_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "groups_stage_code_uidx" ON "groups" USING btree ("stage_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "groups_stage_order_uidx" ON "groups" USING btree ("stage_id","order_index");--> statement-breakpoint
CREATE UNIQUE INDEX "match_sets_match_set_number_uidx" ON "match_sets" USING btree ("match_id","set_number");--> statement-breakpoint
CREATE UNIQUE INDEX "matches_generation_key_uidx" ON "matches" USING btree ("generation_key");--> statement-breakpoint
CREATE INDEX "matches_event_idx" ON "matches" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "matches_stage_idx" ON "matches" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX "matches_group_idx" ON "matches" USING btree ("group_id");