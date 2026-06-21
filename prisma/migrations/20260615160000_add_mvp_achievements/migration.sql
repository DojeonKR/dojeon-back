-- Clear legacy badges (replaced by MVP seed)
DELETE FROM "user_badges";
DELETE FROM "badges";

-- AlterTable
ALTER TABLE "badges" ADD COLUMN "badge_key" TEXT NOT NULL;
ALTER TABLE "badges" ADD COLUMN "category" TEXT NOT NULL;
ALTER TABLE "badges" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "badges_badge_key_key" ON "badges"("badge_key");

-- AlterTable
ALTER TABLE "user_stats" ADD COLUMN "total_completed_courses" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "user_course_completions" (
    "user_id" BIGINT NOT NULL,
    "course_id" INTEGER NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_course_completions_pkey" PRIMARY KEY ("user_id","course_id")
);

-- AddForeignKey
ALTER TABLE "user_course_completions" ADD CONSTRAINT "user_course_completions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_course_completions" ADD CONSTRAINT "user_course_completions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("course_id") ON DELETE CASCADE ON UPDATE CASCADE;
