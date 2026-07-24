ALTER TABLE "sections"
ADD COLUMN "difficulty_easy_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "difficulty_normal_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "difficulty_hard_count" INTEGER NOT NULL DEFAULT 0;

UPDATE "sections" AS s
SET
    "difficulty_easy_count" = counts.easy_count,
    "difficulty_normal_count" = counts.normal_count,
    "difficulty_hard_count" = counts.hard_count
FROM (
    SELECT
        "section_id",
        COUNT(*) FILTER (WHERE "difficulty" = 'EASY')::INTEGER AS easy_count,
        COUNT(*) FILTER (WHERE "difficulty" = 'NORMAL')::INTEGER AS normal_count,
        COUNT(*) FILTER (WHERE "difficulty" = 'HARD')::INTEGER AS hard_count
    FROM "user_section_logs"
    GROUP BY "section_id"
) AS counts
WHERE s."section_id" = counts."section_id"
  AND s."type" = 'GRAMMAR';

ALTER TABLE "sections"
ADD CONSTRAINT "sections_difficulty_easy_count_check" CHECK ("difficulty_easy_count" >= 0),
ADD CONSTRAINT "sections_difficulty_normal_count_check" CHECK ("difficulty_normal_count" >= 0),
ADD CONSTRAINT "sections_difficulty_hard_count_check" CHECK ("difficulty_hard_count" >= 0);

CREATE TABLE "user_section_page_logs" (
    "user_id" BIGINT NOT NULL,
    "section_id" INTEGER NOT NULL,
    "page_number" INTEGER NOT NULL,
    "total_stay_seconds" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_section_page_logs_pkey" PRIMARY KEY ("user_id", "section_id", "page_number"),
    CONSTRAINT "user_section_page_logs_page_number_check" CHECK ("page_number" >= 0),
    CONSTRAINT "user_section_page_logs_stay_seconds_check" CHECK ("total_stay_seconds" >= 0)
);

CREATE INDEX "idx_page_logs_section_page"
ON "user_section_page_logs"("section_id", "page_number");

ALTER TABLE "user_section_page_logs"
ADD CONSTRAINT "user_section_page_logs_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_section_page_logs"
ADD CONSTRAINT "user_section_page_logs_section_id_fkey"
FOREIGN KEY ("section_id") REFERENCES "sections"("section_id") ON DELETE CASCADE ON UPDATE CASCADE;
