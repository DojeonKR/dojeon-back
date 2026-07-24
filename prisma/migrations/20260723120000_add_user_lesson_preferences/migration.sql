CREATE TABLE "user_lesson_preferences" (
    "user_id" BIGINT NOT NULL,
    "lesson_id" INTEGER NOT NULL,
    "selected_types" "SectionType"[] NOT NULL DEFAULT ARRAY['VOCAB', 'GRAMMAR', 'READING', 'LISTENING']::"SectionType"[],
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_lesson_preferences_pkey" PRIMARY KEY ("user_id", "lesson_id")
);

ALTER TABLE "user_lesson_preferences"
ADD CONSTRAINT "user_lesson_preferences_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_lesson_preferences"
ADD CONSTRAINT "user_lesson_preferences_lesson_id_fkey"
FOREIGN KEY ("lesson_id") REFERENCES "lessons"("lesson_id") ON DELETE CASCADE ON UPDATE CASCADE;
