# Course seed data (local only)

JSON under `prisma/data/` is **not committed to Git** (see `.gitignore`).

- Load locally: `npm run prisma:seed`
- Production lesson content should already be in PostgreSQL (Admin API or one-time seed from a private copy of `prisma/data/`).

Restore `prisma/data/` from team storage before seeding a new empty database.
