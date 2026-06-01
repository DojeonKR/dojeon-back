# Course seed data (local only)

JSON under `prisma/data/` is **not committed to Git** (see `.gitignore`).

- Load locally: `npm run prisma:seed`
- Production lesson content should already be in PostgreSQL (Admin API or one-time seed from a private copy of `prisma/data/`).

Restore `prisma/data/` from team storage before seeding a new empty database.

## Dev demo account (non-production only)

`npm run prisma:seed:demo` (or full `npm run prisma:seed`) with `NODE_ENV` not equal to `production` upserts:

| Field | Value |
|-------|--------|
| Login email | `itsfirstdemoemail@gmail.com` |
| Username | `admin` |
| Password | `1234` |
| Role | `admin` (Admin API) |

Use `POST /auth/login` with the **email** and password above (not the username field).
