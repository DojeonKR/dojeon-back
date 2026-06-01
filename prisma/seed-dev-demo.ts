/**
 * 개발/스테이징 전용 데모 계정 시드 (production에서는 no-op)
 *
 * 실행: npm run prisma:seed:demo
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const IS_PRODUCTION = (process.env.NODE_ENV ?? '').toLowerCase() === 'production';

export const DEV_DEMO = {
  email: 'itsfirstdemoemail@gmail.com',
  username: 'admin',
  password: '1234',
  nickname: 'Demo Admin',
} as const;

export async function seedDevDemoUser(client: PrismaClient = prisma): Promise<void> {
  if (IS_PRODUCTION) {
    console.log('⏭️  개발용 데모 계정 — production 환경이라 건너뜀');
    return;
  }

  const usernameTaken = await client.user.findFirst({
    where: {
      username: DEV_DEMO.username,
      email: { not: DEV_DEMO.email },
    },
  });
  if (usernameTaken) {
    console.warn(
      `⚠️  username "${DEV_DEMO.username}" 이 다른 계정에 사용 중이라 데모 계정 시드를 건너뜁니다.`,
    );
    return;
  }

  const passwordHash = await bcrypt.hash(DEV_DEMO.password, 10);
  const user = await client.user.upsert({
    where: { email: DEV_DEMO.email },
    create: {
      email: DEV_DEMO.email,
      username: DEV_DEMO.username,
      nickname: DEV_DEMO.nickname,
      passwordHash,
      role: 'admin',
      isTermsAgreed: true,
      isPrivacyAgreed: true,
      isAgeVerified: true,
      isOnboarded: true,
    },
    update: {
      username: DEV_DEMO.username,
      nickname: DEV_DEMO.nickname,
      passwordHash,
      role: 'admin',
      isTermsAgreed: true,
      isPrivacyAgreed: true,
      isAgeVerified: true,
    },
  });

  await client.userStats.upsert({
    where: { userId: user.id },
    create: { userId: user.id },
    update: {},
  });

  console.log(`✅ 개발용 데모 계정 준비됨`);
  console.log(`   로그인 email: ${DEV_DEMO.email}`);
  console.log(`   username: ${DEV_DEMO.username} (로그인 필드 아님)`);
  console.log(`   password: ${DEV_DEMO.password}`);
  console.log(`   role: admin`);
}

async function main() {
  await seedDevDemoUser();
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error('❌ 데모 계정 시드 실패:', e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
