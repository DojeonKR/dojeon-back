/**
 * 코스 콘텐츠만 시드 (프로덕션 Docker·EC2 호스트 공통, ts-node 불필요)
 *
 * 실행: node prisma/seed-courses.js
 * 강제 재입력: node prisma/seed-courses.js --force
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const FORCE = process.argv.includes('--force');
const DATA_DIR = path.join(__dirname, 'data');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function getSortedDirs(dir) {
  return fs
    .readdirSync(dir)
    .filter((name) => fs.statSync(path.join(dir, name)).isDirectory())
    .sort();
}

function getSectionFiles(lessonDir) {
  return fs
    .readdirSync(lessonDir)
    .filter((name) => name.startsWith('section-') && name.endsWith('.json'))
    .sort();
}

async function seedSection(lessonId, sectionData) {
  let section = await prisma.section.findFirst({
    where: { lessonId, orderNum: sectionData.orderNum },
  });
  if (section) {
    section = await prisma.section.update({
      where: { id: section.id },
      data: { type: sectionData.type, title: sectionData.title, totalPages: sectionData.totalPages },
    });
  } else {
    section = await prisma.section.create({
      data: {
        lessonId,
        type: sectionData.type,
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
      data: sectionData.cards.map((c) => ({
        sectionId: section.id,
        sequence: c.sequence,
        wordFront: c.wordFront,
        wordBack: c.wordBack,
        notes: c.notes ?? null,
        locales:
          c.locales != null && Object.keys(c.locales).length > 0 ? c.locales : undefined,
        audioUrl: c.audioUrl ?? null,
      })),
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

    const courseData = readJson(courseJsonPath);
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

      const lessonData = readJson(lessonJsonPath);
      let lesson = await prisma.lesson.findFirst({
        where: { courseId: course.id, orderNum: lessonData.orderNum },
      });
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
        const sectionData = readJson(path.join(lessonDir, sectionFile));
        await seedSection(lesson.id, sectionData);
      }
    }
  }
}

async function main() {
  console.log(`🌱 코스 시드 시작${FORCE ? ' (--force 모드)' : ''}\n`);
  await seedCourses();
  console.log('\n🎉 시드 완료');
}

main()
  .catch((e) => {
    console.error('❌ 시드 실패:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
