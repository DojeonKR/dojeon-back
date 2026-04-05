-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'PREMIUM');

-- CreateEnum
CREATE TYPE "SectionType" AS ENUM ('VOCAB', 'GRAMMAR', 'READING', 'LISTENING', 'QUIZ');

-- CreateEnum
CREATE TYPE "ScrapType" AS ENUM ('VOCAB', 'GRAMMAR');

-- CreateTable
CREATE TABLE "users" (
    "user_id" BIGSERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "nickname" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "phone_number" TEXT,
    "birthday" DATE,
    "profile_img_url" TEXT,
    "social_provider" TEXT,
    "social_uid" TEXT,
    "device_token" TEXT,
    "mother_language" TEXT,
    "proficiency_level" TEXT,
    "age_group" TEXT,
    "daily_goal_min" INTEGER,
    "learning_goal" TEXT,
    "subscription_tier" "SubscriptionTier" NOT NULL DEFAULT 'FREE',
    "is_push_notification_on" BOOLEAN NOT NULL DEFAULT true,
    "is_marketing_agreed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "user_stats" (
    "user_id" BIGINT NOT NULL,
    "total_study_min" INTEGER NOT NULL DEFAULT 0,
    "current_streak" INTEGER NOT NULL DEFAULT 0,
    "max_streak" INTEGER NOT NULL DEFAULT 0,
    "total_completed_lessons" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_stats_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "user_attendance" (
    "attendance_id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "attendance_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_attendance_pkey" PRIMARY KEY ("attendance_id")
);

-- CreateTable
CREATE TABLE "badges" (
    "badge_id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "badges_pkey" PRIMARY KEY ("badge_id")
);

-- CreateTable
CREATE TABLE "user_badges" (
    "mapping_id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "badge_id" INTEGER NOT NULL,
    "earned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_badges_pkey" PRIMARY KEY ("mapping_id")
);

-- CreateTable
CREATE TABLE "courses" (
    "course_id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "order_num" INTEGER NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("course_id")
);

-- CreateTable
CREATE TABLE "lessons" (
    "lesson_id" SERIAL NOT NULL,
    "course_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "order_num" INTEGER NOT NULL,

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("lesson_id")
);

-- CreateTable
CREATE TABLE "sections" (
    "section_id" SERIAL NOT NULL,
    "lesson_id" INTEGER NOT NULL,
    "type" "SectionType" NOT NULL,
    "title" TEXT NOT NULL,
    "total_pages" INTEGER NOT NULL,
    "order_num" INTEGER NOT NULL,

    CONSTRAINT "sections_pkey" PRIMARY KEY ("section_id")
);

-- CreateTable
CREATE TABLE "section_cards" (
    "card_id" SERIAL NOT NULL,
    "section_id" INTEGER NOT NULL,
    "word_front" TEXT NOT NULL,
    "word_back" TEXT NOT NULL,
    "audio_url" TEXT,
    "sequence" INTEGER NOT NULL,

    CONSTRAINT "section_cards_pkey" PRIMARY KEY ("card_id")
);

-- CreateTable
CREATE TABLE "section_materials" (
    "material_id" SERIAL NOT NULL,
    "section_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "is_extra" BOOLEAN NOT NULL DEFAULT false,
    "content_text" JSONB NOT NULL,

    CONSTRAINT "section_materials_pkey" PRIMARY KEY ("material_id")
);

-- CreateTable
CREATE TABLE "section_questions" (
    "question_id" SERIAL NOT NULL,
    "section_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "question_text" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "answer" TEXT NOT NULL,
    "explanation" TEXT,

    CONSTRAINT "section_questions_pkey" PRIMARY KEY ("question_id")
);

-- CreateTable
CREATE TABLE "user_section_logs" (
    "log_id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "section_id" INTEGER NOT NULL,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "max_page_reached" INTEGER NOT NULL DEFAULT 0,
    "total_stay_seconds" INTEGER NOT NULL DEFAULT 0,
    "difficulty" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_section_logs_pkey" PRIMARY KEY ("log_id")
);

-- CreateTable
CREATE TABLE "scraps" (
    "scrap_id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "section_id" INTEGER,
    "type" "ScrapType" NOT NULL,
    "card_id" INTEGER,
    "material_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scraps_pkey" PRIMARY KEY ("scrap_id")
);

-- CreateTable
CREATE TABLE "practice_topics" (
    "topic_id" SERIAL NOT NULL,
    "title_en" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "practice_topics_pkey" PRIMARY KEY ("topic_id")
);

-- CreateTable
CREATE TABLE "practice_questions" (
    "question_id" SERIAL NOT NULL,
    "topic_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "question_text" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "answer" TEXT NOT NULL,
    "explanation" TEXT,

    CONSTRAINT "practice_questions_pkey" PRIMARY KEY ("question_id")
);

-- CreateTable
CREATE TABLE "subscription_plans" (
    "plan_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "price_text" TEXT NOT NULL,
    "sub_text" TEXT,
    "has_trial" BOOLEAN NOT NULL DEFAULT false,
    "billing_cycle_months" INTEGER NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("plan_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_social_provider_social_uid_key" ON "users"("social_provider", "social_uid");

-- CreateIndex
CREATE UNIQUE INDEX "user_attendance_user_id_attendance_date_key" ON "user_attendance"("user_id", "attendance_date");

-- CreateIndex
CREATE UNIQUE INDEX "user_badges_user_id_badge_id_key" ON "user_badges"("user_id", "badge_id");

-- CreateIndex
CREATE INDEX "idx_logs_user" ON "user_section_logs"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_section_logs_user_id_section_id_key" ON "user_section_logs"("user_id", "section_id");

-- CreateIndex
CREATE INDEX "idx_scraps_user_type" ON "scraps"("user_id", "type");

-- AddForeignKey
ALTER TABLE "user_stats" ADD CONSTRAINT "user_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_attendance" ADD CONSTRAINT "user_attendance_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "badges"("badge_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("course_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("lesson_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_cards" ADD CONSTRAINT "section_cards_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("section_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_materials" ADD CONSTRAINT "section_materials_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("section_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_questions" ADD CONSTRAINT "section_questions_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("section_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_section_logs" ADD CONSTRAINT "user_section_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_section_logs" ADD CONSTRAINT "user_section_logs_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("section_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scraps" ADD CONSTRAINT "scraps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scraps" ADD CONSTRAINT "scraps_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("section_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scraps" ADD CONSTRAINT "scraps_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "section_cards"("card_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scraps" ADD CONSTRAINT "scraps_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "section_materials"("material_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_questions" ADD CONSTRAINT "practice_questions_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "practice_topics"("topic_id") ON DELETE CASCADE ON UPDATE CASCADE;
