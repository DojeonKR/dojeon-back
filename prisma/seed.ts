/**
 * Prisma Seed Script
 *
 * 실행: npx ts-node prisma/seed.ts
 * 강제 재입력: npx ts-node prisma/seed.ts --force
 *
 * --force 플래그: 기존 섹션의 카드/자료/문제를 삭제 후 재생성합니다.
 *   주의: 사용자의 스크랩(Scrap) 중 cardId/materialId 참조가 null로 변경될 수 있습니다.
 *   운영 DB에서는 사용하지 마세요.
 *
 * 안전 보장:
 *   - User, UserStats, UserSectionLog 등 사용자 데이터는 절대 건드리지 않습니다.
 *   - Course/Lesson/Section은 upsert로 중복 생성을 방지합니다.
 *   - 기본 모드에서는 이미 콘텐츠가 있는 섹션은 건너뜁니다.
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const FORCE = process.argv.includes('--force');
const DATA_DIR = path.join(__dirname, 'data');

interface CardData {
  sequence: number;
  wordFront: string;
  wordBack: string;
  audioUrl: string | null;
}

interface MaterialData {
  sequence: number;
  type: string;
  isExtra: boolean;
  contentText: object;
}

interface QuestionData {
  type: string;
  questionText: string;
  options: string[];
  answer: string;
  explanation: string | null;
}

interface SectionData {
  type: string;
  title: string;
  orderNum: number;
  totalPages: number;
  cards: CardData[];
  materials: MaterialData[];
  questions: QuestionData[];
}

interface LessonData {
  title: string;
  subtitle: string | null;
  orderNum: number;
}

interface CourseData {
  title: string;
  description: string | null;
  orderNum: number;
  isActive: boolean;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

function getSortedDirs(dir: string): string[] {
  return fs
    .readdirSync(dir)
    .filter((name) => fs.statSync(path.join(dir, name)).isDirectory())
    .sort();
}

function getSectionFiles(lessonDir: string): string[] {
  return fs
    .readdirSync(lessonDir)
    .filter((name) => name.startsWith('section-') && name.endsWith('.json'))
    .sort();
}

async function seedSection(lessonId: number, sectionData: SectionData) {
  let section = await prisma.section.findFirst({
    where: { lessonId, orderNum: sectionData.orderNum },
  });
  if (section) {
    section = await prisma.section.update({
      where: { id: section.id },
      data: { type: sectionData.type as any, title: sectionData.title, totalPages: sectionData.totalPages },
    });
  } else {
    section = await prisma.section.create({
      data: {
        lessonId,
        type: sectionData.type as any,
        title: sectionData.title,
        orderNum: sectionData.orderNum,
        totalPages: sectionData.totalPages,
      },
    });
  }

  const [existingCards, existingMaterials, existingQuestions] = await Promise.all([
    prisma.sectionCard.count({ where: { sectionId: section.id } }),
    prisma.sectionMaterial.count({ where: { sectionId: section.id } }),
    prisma.sectionQuestion.count({ where: { sectionId: section.id } }),
  ]);

  const hasContent = existingCards > 0 || existingMaterials > 0 || existingQuestions > 0;

  if (hasContent && !FORCE) {
    console.log(`    ⏭  섹션 "${sectionData.title}" — 이미 콘텐츠 있음 (건너뜀, --force로 강제 재입력)`);
    return;
  }

  if (hasContent && FORCE) {
    console.log(`    ♻️  섹션 "${sectionData.title}" — 기존 콘텐츠 삭제 후 재입력 (--force)`);
    await prisma.sectionCard.deleteMany({ where: { sectionId: section.id } });
    await prisma.sectionMaterial.deleteMany({ where: { sectionId: section.id } });
    await prisma.sectionQuestion.deleteMany({ where: { sectionId: section.id } });
  }

  if (sectionData.cards.length > 0) {
    await prisma.sectionCard.createMany({
      data: sectionData.cards.map((c) => ({ ...c, sectionId: section.id })),
    });
  }

  if (sectionData.materials.length > 0) {
    await prisma.sectionMaterial.createMany({
      data: sectionData.materials.map((m) => ({ ...m, sectionId: section.id })),
    });
  }

  if (sectionData.questions.length > 0) {
    await prisma.sectionQuestion.createMany({
      data: sectionData.questions.map((q) => ({ ...q, sectionId: section.id })),
    });
  }

  console.log(
    `    ✅ 섹션 "${sectionData.title}" — 카드 ${sectionData.cards.length}개, 자료 ${sectionData.materials.length}개, 문제 ${sectionData.questions.length}개`,
  );
}

async function seedCourses() {
  if (!fs.existsSync(DATA_DIR)) {
    console.log('prisma/data 폴더가 없습니다. 콘텐츠 JSON을 추가해주세요.');
    return;
  }

  const courseFolders = getSortedDirs(DATA_DIR);

  for (const courseFolder of courseFolders) {
    const courseDir = path.join(DATA_DIR, courseFolder);
    const courseJsonPath = path.join(courseDir, 'course.json');
    if (!fs.existsSync(courseJsonPath)) continue;

    const courseData = readJson<CourseData>(courseJsonPath);
    let course = await prisma.course.findFirst({ where: { orderNum: courseData.orderNum } });
    if (course) {
      course = await prisma.course.update({
        where: { id: course.id },
        data: { title: courseData.title, description: courseData.description, isActive: courseData.isActive },
      });
    } else {
      course = await prisma.course.create({ data: courseData });
    }
    console.log(`📚 코스: "${course.title}"`);

    const lessonFolders = getSortedDirs(courseDir);
    for (const lessonFolder of lessonFolders) {
      const lessonDir = path.join(courseDir, lessonFolder);
      const lessonJsonPath = path.join(lessonDir, 'lesson.json');
      if (!fs.existsSync(lessonJsonPath)) continue;

      const lessonData = readJson<LessonData>(lessonJsonPath);
      let lesson = await prisma.lesson.findFirst({ where: { courseId: course.id, orderNum: lessonData.orderNum } });
      if (lesson) {
        lesson = await prisma.lesson.update({
          where: { id: lesson.id },
          data: { title: lessonData.title, subtitle: lessonData.subtitle },
        });
      } else {
        lesson = await prisma.lesson.create({ data: { ...lessonData, courseId: course.id } });
      }
      console.log(`  📖 레슨: "${lesson.title}"`);

      const sectionFiles = getSectionFiles(lessonDir);
      for (const sectionFile of sectionFiles) {
        const sectionData = readJson<SectionData>(path.join(lessonDir, sectionFile));
        await seedSection(lesson.id, sectionData);
      }
    }
  }
}

async function seedStaticData() {
  // 뱃지
  const badges = [
    { title: '첫 발걸음', description: '첫 레슨을 완료했습니다.', imageUrl: 'https://cdn.dojeon.local/badges/first.png' },
    { title: '7일 연속', description: '7일 연속으로 학습했습니다.', imageUrl: 'https://cdn.dojeon.local/badges/streak7.png' },
    { title: '30일 연속', description: '30일 연속으로 학습했습니다.', imageUrl: 'https://cdn.dojeon.local/badges/streak30.png' },
  ];
  for (const b of badges) {
    const existing = await prisma.badge.findFirst({ where: { title: b.title } });
    if (!existing) await prisma.badge.create({ data: b });
  }

  // 구독 플랜
  const plans = [
    { id: 'free', title: 'Free', priceText: '₩0', subText: '기본 학습', hasTrial: false, billingCycleMonths: 0 },
    { id: 'basic', title: 'Basic', priceText: '₩9,900/월', subText: null, hasTrial: true, billingCycleMonths: 1 },
    { id: 'pro', title: 'Pro', priceText: '₩19,900/월', subText: '전체 콘텐츠', hasTrial: true, billingCycleMonths: 1 },
    { id: 'annual', title: 'Annual', priceText: '₩199,000/년', subText: '2개월 무료', hasTrial: false, billingCycleMonths: 12 },
  ];
  for (const p of plans) {
    await prisma.subscriptionPlan.upsert({ where: { id: p.id }, create: p, update: p });
  }

  console.log('✅ 뱃지 & 구독 플랜 시드 완료');
}

async function main() {
  console.log(`🌱 시드 시작${FORCE ? ' (--force 모드)' : ''}\n`);
  await seedStaticData();
  console.log('');
  await seedCourses();
  console.log('\n🎉 시드 완료');
}

main()
  .catch((e) => {
    console.error('❌ 시드 실패:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
