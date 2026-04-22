-- CreateTable
CREATE TABLE "nlp_jobs" (
    "job_id" TEXT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "input_text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nlp_jobs_pkey" PRIMARY KEY ("job_id")
);

-- CreateIndex
CREATE INDEX "nlp_jobs_user_id_status_idx" ON "nlp_jobs"("user_id", "status");

-- AddForeignKey
ALTER TABLE "nlp_jobs" ADD CONSTRAINT "nlp_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
