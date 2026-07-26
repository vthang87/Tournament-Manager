WITH "super_admin_candidate" AS (
	SELECT "id"
	FROM "users"
	WHERE
		"active" = true
		AND ("id" = 'seed-user-admin' OR "role" = 'ADMIN')
	ORDER BY
		CASE WHEN "id" = 'seed-user-admin' THEN 0 ELSE 1 END,
		CASE WHEN "role" = 'ADMIN' THEN 0 ELSE 1 END,
		"created_at"
	LIMIT 1
)
UPDATE "users"
SET
	"role" = 'SUPER_ADMIN',
	"updated_at" = CURRENT_TIMESTAMP::text
WHERE
	"id" = (SELECT "id" FROM "super_admin_candidate")
	AND NOT EXISTS (
		SELECT 1
		FROM "users"
		WHERE "role" = 'SUPER_ADMIN' AND "active" = true
	);
