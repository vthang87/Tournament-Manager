CREATE TABLE "sports" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
INSERT INTO "sports" ("id", "code", "name", "active", "created_at", "updated_at")
VALUES
	('sport-badminton', 'BADMINTON', 'Badminton', true, CURRENT_TIMESTAMP::text, CURRENT_TIMESTAMP::text),
	('sport-pickleball', 'PICKLEBALL', 'Pickleball', true, CURRENT_TIMESTAMP::text, CURRENT_TIMESTAMP::text)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
CREATE TABLE "tournament_members" (
	"tournament_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "tournament_members_tournament_id_user_id_pk" PRIMARY KEY("tournament_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "player_sports" (
	"player_id" text NOT NULL,
	"sport_id" text NOT NULL,
	"club_id" text,
	"ranking" integer,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "player_sports_player_id_sport_id_pk" PRIMARY KEY("player_id","sport_id")
);
--> statement-breakpoint
ALTER TABLE "players" DROP CONSTRAINT "players_club_id_clubs_id_fk";
--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "owner_user_id" text;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "sport_id" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "owner_user_id" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "owner_user_id" text;--> statement-breakpoint
UPDATE "tournaments"
SET
	"owner_user_id" = COALESCE(
		(SELECT "id" FROM "users" WHERE "id" = 'seed-user-admin' LIMIT 1),
		(SELECT "id" FROM "users" WHERE "active" = true ORDER BY "created_at" LIMIT 1)
	),
	"sport_id" = CASE
		WHEN lower("slug") LIKE '%pickleball%' THEN 'sport-pickleball'
		ELSE 'sport-badminton'
	END;
--> statement-breakpoint
UPDATE "clubs"
SET "owner_user_id" = COALESCE(
	(SELECT "id" FROM "users" WHERE "id" = 'seed-user-admin' LIMIT 1),
	(SELECT "id" FROM "users" WHERE "active" = true ORDER BY "created_at" LIMIT 1)
);
--> statement-breakpoint
UPDATE "players"
SET "owner_user_id" = COALESCE(
	(SELECT "id" FROM "users" WHERE "id" = 'seed-user-admin' LIMIT 1),
	(SELECT "id" FROM "users" WHERE "active" = true ORDER BY "created_at" LIMIT 1)
);
--> statement-breakpoint
INSERT INTO "player_sports" (
	"player_id",
	"sport_id",
	"club_id",
	"ranking",
	"created_at",
	"updated_at"
)
SELECT DISTINCT
	p."id",
	t."sport_id",
	p."club_id",
	p."ranking",
	p."created_at",
	p."updated_at"
FROM "players" p
INNER JOIN "entry_members" em ON em."player_id" = p."id"
INNER JOIN "entries" e ON e."id" = em."entry_id"
INNER JOIN "tournament_events" te ON te."id" = e."event_id"
INNER JOIN "tournaments" t ON t."id" = te."tournament_id"
ON CONFLICT ("player_id", "sport_id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "player_sports" (
	"player_id",
	"sport_id",
	"club_id",
	"ranking",
	"created_at",
	"updated_at"
)
SELECT
	p."id",
	CASE
		WHEN upper(COALESCE(p."metadata_json", '')) LIKE '%PICKLEBALL%'
			THEN 'sport-pickleball'
		ELSE 'sport-badminton'
	END,
	p."club_id",
	p."ranking",
	p."created_at",
	p."updated_at"
FROM "players" p
ON CONFLICT ("player_id", "sport_id") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "tournaments" ALTER COLUMN "owner_user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ALTER COLUMN "sport_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "clubs" ALTER COLUMN "owner_user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ALTER COLUMN "owner_user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tournament_members" ADD CONSTRAINT "tournament_members_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_members" ADD CONSTRAINT "tournament_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_sports" ADD CONSTRAINT "player_sports_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_sports" ADD CONSTRAINT "player_sports_sport_id_sports_id_fk" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_sports" ADD CONSTRAINT "player_sports_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sports_code_uidx" ON "sports" USING btree ("code");--> statement-breakpoint
CREATE INDEX "tournament_members_user_id_idx" ON "tournament_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "player_sports_player_sport_uidx" ON "player_sports" USING btree ("player_id","sport_id");--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_sport_id_sports_id_fk" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tournaments_owner_user_id_idx" ON "tournaments" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "tournaments_sport_id_idx" ON "tournaments" USING btree ("sport_id");--> statement-breakpoint
CREATE INDEX "clubs_owner_name_idx" ON "clubs" USING btree ("owner_user_id","name");--> statement-breakpoint
ALTER TABLE "players" DROP COLUMN "club_id";--> statement-breakpoint
ALTER TABLE "players" DROP COLUMN "ranking";
