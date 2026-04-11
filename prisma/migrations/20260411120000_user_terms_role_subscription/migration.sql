-- AlterTable
ALTER TABLE "users" ADD COLUMN     "subscription_plan_id" TEXT,
ADD COLUMN     "subscription_expires_at" TIMESTAMP(3),
ADD COLUMN     "is_terms_agreed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_privacy_agreed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_age_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'user';
