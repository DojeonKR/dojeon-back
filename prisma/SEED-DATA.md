# App and course seed data

JSON under `prisma/data/` is the source of truth for achievements, subscription plans, and course content.

- Load all data locally: `npm run prisma:seed`
- Load achievements and subscription plans only: `npm run prisma:seed:app-data`
- Replace one lesson from JSON: `node prisma/seed-courses.js --course=1 --lesson=3 --force`
- Load missing course content only: `npm run prisma:seed:courses`
- Production Docker startup runs both production-safe seeds after migrations. Course content uses `--missing-only`, so existing administrator-managed data is preserved and only missing records/content are added.

Use `npm run prisma:validate-data` before deployment to validate the course JSON without a database.

## Dev demo account (non-production only)

`npm run prisma:seed:demo` (or full `npm run prisma:seed`) with `NODE_ENV` not equal to `production` upserts:

| Field       | Value                         |
| ----------- | ----------------------------- |
| Login email | `itsfirstdemoemail@gmail.com` |
| Username    | `admin`                       |
| Password    | `1234`                        |
| Role        | `admin` (Admin API)           |

Use `POST /auth/login` with the **email** and password above (not the username field).
