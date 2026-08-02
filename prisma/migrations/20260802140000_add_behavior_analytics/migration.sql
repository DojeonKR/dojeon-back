BEGIN;

ALTER TABLE "users"
  ADD COLUMN "weekly_goal_min" INTEGER,
  ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC';

ALTER TABLE "scraps"
  ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "counted_is_active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "add_count" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "remove_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "last_state_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

WITH duplicate_counts AS (
  SELECT MIN("scrap_id") AS keep_id, COUNT(*)::INTEGER AS add_count
  FROM "scraps"
  WHERE "card_id" IS NOT NULL
  GROUP BY "user_id", "card_id"
)
UPDATE "scraps" s
SET "add_count" = d.add_count
FROM duplicate_counts d
WHERE s."scrap_id" = d.keep_id;

UPDATE "scraps" s
SET "is_active" = false,
    "counted_is_active" = false,
    "updated_at" = CURRENT_TIMESTAMP,
    "last_state_changed_at" = CURRENT_TIMESTAMP
FROM "scraps" keep
WHERE s."card_id" IS NOT NULL
  AND keep."card_id" = s."card_id"
  AND keep."user_id" = s."user_id"
  AND keep."scrap_id" < s."scrap_id";

WITH duplicate_counts AS (
  SELECT MIN("scrap_id") AS keep_id, COUNT(*)::INTEGER AS add_count
  FROM "scraps"
  WHERE "material_id" IS NOT NULL
  GROUP BY "user_id", "material_id"
)
UPDATE "scraps" s
SET "add_count" = GREATEST(s."add_count", d.add_count)
FROM duplicate_counts d
WHERE s."scrap_id" = d.keep_id;

UPDATE "scraps" s
SET "is_active" = false,
    "counted_is_active" = false,
    "updated_at" = CURRENT_TIMESTAMP,
    "last_state_changed_at" = CURRENT_TIMESTAMP
FROM "scraps" keep
WHERE s."material_id" IS NOT NULL
  AND keep."material_id" = s."material_id"
  AND keep."user_id" = s."user_id"
  AND keep."scrap_id" < s."scrap_id";

CREATE INDEX "idx_scraps_user_card" ON "scraps"("user_id", "card_id");
CREATE INDEX "idx_scraps_user_material" ON "scraps"("user_id", "material_id");
CREATE UNIQUE INDEX "uk_scraps_active_user_card"
  ON "scraps"("user_id", "card_id")
  WHERE "card_id" IS NOT NULL AND "is_active" = true;
CREATE UNIQUE INDEX "uk_scraps_active_user_material"
  ON "scraps"("user_id", "material_id")
  WHERE "material_id" IS NOT NULL AND "is_active" = true;
CREATE INDEX "idx_scraps_user_type_active" ON "scraps"("user_id", "type", "is_active");

ALTER TABLE "scraps"
  ADD CONSTRAINT "scraps_add_count_check" CHECK ("add_count" >= 0),
  ADD CONSTRAINT "scraps_remove_count_check" CHECK ("remove_count" >= 0);

CREATE TABLE "user_daily_activities" (
  "user_id" BIGINT NOT NULL,
  "activity_date" DATE NOT NULL,
  "timezone" TEXT NOT NULL,
  "study_seconds" INTEGER NOT NULL DEFAULT 0,
  "daily_goal_min_snapshot" INTEGER,
  "goal_achieved" BOOLEAN NOT NULL DEFAULT false,
  "goal_achieved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_daily_activities_pkey" PRIMARY KEY ("user_id", "activity_date")
);

CREATE INDEX "idx_daily_activity_goal_date"
  ON "user_daily_activities"("user_id", "goal_achieved", "activity_date");

ALTER TABLE "user_daily_activities"
  ADD CONSTRAINT "user_daily_activities_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_daily_activities"
  ADD CONSTRAINT "user_daily_activities_study_seconds_check" CHECK ("study_seconds" >= 0);

CREATE TABLE "user_section_question_stats" (
  "user_id" BIGINT NOT NULL,
  "question_id" INTEGER NOT NULL,
  "correct_count" INTEGER NOT NULL DEFAULT 0,
  "wrong_count" INTEGER NOT NULL DEFAULT 0,
  "last_answered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_section_question_stats_pkey" PRIMARY KEY ("user_id", "question_id")
);

CREATE INDEX "idx_section_question_stats_question"
  ON "user_section_question_stats"("question_id");

ALTER TABLE "user_section_question_stats"
  ADD CONSTRAINT "user_section_question_stats_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_section_question_stats"
  ADD CONSTRAINT "user_section_question_stats_question_id_fkey"
  FOREIGN KEY ("question_id") REFERENCES "section_questions"("question_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_section_question_stats"
  ADD CONSTRAINT "user_section_question_stats_correct_count_check" CHECK ("correct_count" >= 0),
  ADD CONSTRAINT "user_section_question_stats_wrong_count_check" CHECK ("wrong_count" >= 0);

CREATE TABLE "user_practice_question_stats" (
  "user_id" BIGINT NOT NULL,
  "question_id" INTEGER NOT NULL,
  "correct_count" INTEGER NOT NULL DEFAULT 0,
  "wrong_count" INTEGER NOT NULL DEFAULT 0,
  "last_answered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_practice_question_stats_pkey" PRIMARY KEY ("user_id", "question_id")
);

CREATE INDEX "idx_practice_question_stats_question"
  ON "user_practice_question_stats"("question_id");

ALTER TABLE "user_practice_question_stats"
  ADD CONSTRAINT "user_practice_question_stats_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_practice_question_stats"
  ADD CONSTRAINT "user_practice_question_stats_question_id_fkey"
  FOREIGN KEY ("question_id") REFERENCES "practice_questions"("question_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_practice_question_stats"
  ADD CONSTRAINT "user_practice_question_stats_correct_count_check" CHECK ("correct_count" >= 0),
  ADD CONSTRAINT "user_practice_question_stats_wrong_count_check" CHECK ("wrong_count" >= 0);

COMMIT;
