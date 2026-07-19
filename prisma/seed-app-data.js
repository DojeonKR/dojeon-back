/**
 * Production-safe app catalog seed.
 *
 * Synchronizes achievements and subscription plans without deleting users.
 * Run: node prisma/seed-app-data.js
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const APP_DATA_PATH = path.join(__dirname, 'data', 'app-data.json');

function readAppData() {
  return JSON.parse(fs.readFileSync(APP_DATA_PATH, 'utf-8'));
}

async function main() {
  const { badges, subscriptionPlans } = readAppData();

  const badgeKeys = badges.map((badge) => badge.key);
  const planIds = subscriptionPlans.map((plan) => plan.id);

  for (const badge of badges) {
    await prisma.badge.upsert({
      where: { key: badge.key },
      create: badge,
      update: badge,
    });
  }

  for (const plan of subscriptionPlans) {
    await prisma.subscriptionPlan.upsert({
      where: { id: plan.id },
      create: plan,
      update: plan,
    });
  }

  // The JSON catalog is the source of truth. Remove legacy catalog rows that are
  // no longer present so clients do not receive stale achievements or plans.
  const [deletedBadges, deletedPlans] = await Promise.all([
    prisma.badge.deleteMany({ where: { key: { notIn: badgeKeys } } }),
    prisma.subscriptionPlan.deleteMany({ where: { id: { notIn: planIds } } }),
  ]);

  // Every existing account qualifies for Signed up. Users with learning logs
  // also qualify for First Start, including accounts created before this seed.
  const [users, startedUsers, signedUpBadge, firstStartBadge] = await Promise.all([
    prisma.user.findMany({ select: { id: true } }),
    prisma.userSectionLog.findMany({ distinct: ['userId'], select: { userId: true } }),
    prisma.badge.findUnique({ where: { key: 'signed_up' }, select: { id: true } }),
    prisma.badge.findUnique({ where: { key: 'first_start' }, select: { id: true } }),
  ]);

  const earnedRows = [];
  if (signedUpBadge) {
    earnedRows.push(...users.map((user) => ({ userId: user.id, badgeId: signedUpBadge.id })));
  }
  if (firstStartBadge) {
    earnedRows.push(
      ...startedUsers.map((user) => ({ userId: user.userId, badgeId: firstStartBadge.id })),
    );
  }
  if (earnedRows.length > 0) {
    await prisma.userBadge.createMany({ data: earnedRows, skipDuplicates: true });
  }

  console.log(
    `✅ App data seed complete: ${badges.length} achievements, ${subscriptionPlans.length} subscription plans, ${deletedBadges.count} legacy achievements removed, ${deletedPlans.count} legacy plans removed`,
  );
}

main()
  .catch((error) => {
    console.error('❌ App data seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
