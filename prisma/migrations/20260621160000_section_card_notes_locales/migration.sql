-- AlterTable: section_cards에 notes, locales 추가 (Lesson 1 VOCAB 시드용)
ALTER TABLE "section_cards" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "section_cards" ADD COLUMN IF NOT EXISTS "locales" JSONB;
