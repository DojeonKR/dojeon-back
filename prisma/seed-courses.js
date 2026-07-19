/**
 * 코스 콘텐츠만 시드 (프로덕션 Docker·EC2 호스트 공통, ts-node 불필요)
 *
 * 실행: node prisma/seed-courses.js
 * 강제 재입력: node prisma/seed-courses.js --force
 * 누락 데이터만 추가: node prisma/seed-courses.js --missing-only
 * 특정 레슨 교체: node prisma/seed-courses.js --course=1 --lesson=3 --force
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const FORCE = process.argv.includes('--force');
const MISSING_ONLY = process.argv.includes('--missing-only');
const COURSE_FILTER = readNumberFlag('--course');
const LESSON_FILTER = readNumberFlag('--lesson');
const DATA_DIR = path.join(__dirname, 'data');

function readNumberFlag(name) {
  const prefix = `${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  if (raw == null) return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

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
      data: {
        type: sectionData.type,
        title: sectionData.title,
        totalPages: sectionData.totalPages,
      },
    });
  } else if (!section) {
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
  const shouldSeedCards = (FORCE || existingCards === 0) && sectionData.cards.length > 0;
  const shouldSeedMaterials =
    (FORCE || existingMaterials === 0) && sectionData.materials.length > 0;
  const shouldSeedQuestions =
    (FORCE || existingQuestions === 0) && sectionData.questions.length > 0;

  if (hasContent && !FORCE && !MISSING_ONLY) {
    console.log(
      `    ⏭  섹션 "${sectionData.title}" — 이미 콘텐츠 있음 (건너뜀, --force로 강제 재입력)`,
    );
    return;
  }

  if (MISSING_ONLY && !shouldSeedCards && !shouldSeedMaterials && !shouldSeedQuestions) {
    console.log(`    ⏭  섹션 "${sectionData.title}" — 누락 콘텐츠 없음`);
    return;
  }

  if (hasContent && FORCE) {
    console.log(`    ♻️  섹션 "${sectionData.title}" — 기존 콘텐츠 삭제 후 재입력 (--force)`);
    await prisma.sectionCard.deleteMany({ where: { sectionId: section.id } });
    await prisma.sectionMaterial.deleteMany({ where: { sectionId: section.id } });
    await prisma.sectionQuestion.deleteMany({ where: { sectionId: section.id } });
  }

  if (shouldSeedCards) {
    await prisma.sectionCard.createMany({
      data: sectionData.cards.map((c) => ({
        sectionId: section.id,
        sequence: c.sequence,
        wordFront: c.wordFront,
        wordBack: c.wordBack,
        notes: c.notes ?? null,
        locales: c.locales != null && Object.keys(c.locales).length > 0 ? c.locales : undefined,
        audioUrl: c.audioUrl ?? null,
      })),
    });
  }

  if (shouldSeedMaterials) {
    await prisma.sectionMaterial.createMany({
      data: sectionData.materials.map((m) => ({ ...m, sectionId: section.id })),
    });
  }

  if (shouldSeedQuestions) {
    await prisma.sectionQuestion.createMany({
      data: sectionData.questions.map((q) => ({ ...q, sectionId: section.id })),
    });
  }

  console.log(
    `    ✅ 섹션 "${sectionData.title}" — 카드 ${shouldSeedCards ? sectionData.cards.length : 0}개, 자료 ${shouldSeedMaterials ? sectionData.materials.length : 0}개, 문제 ${shouldSeedQuestions ? sectionData.questions.length : 0}개 추가`,
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
    if (COURSE_FILTER !== null && courseData.orderNum !== COURSE_FILTER) continue;
    let course = await prisma.course.findFirst({ where: { orderNum: courseData.orderNum } });
    if (course) {
      course = await prisma.course.update({
        where: { id: course.id },
        data: {
          title: courseData.title,
          description: courseData.description,
          isActive: courseData.isActive,
        },
      });
    } else if (!course) {
      course = await prisma.course.create({ data: courseData });
    }
    console.log(`📚 코스: "${course.title}"`);

    const lessonFolders = getSortedDirs(courseDir);
    for (const lessonFolder of lessonFolders) {
      const lessonDir = path.join(courseDir, lessonFolder);
      const lessonJsonPath = path.join(lessonDir, 'lesson.json');
      if (!fs.existsSync(lessonJsonPath)) continue;

      const lessonData = readJson(lessonJsonPath);
      if (LESSON_FILTER !== null && lessonData.orderNum !== LESSON_FILTER) continue;
      let lesson = await prisma.lesson.findFirst({
        where: { courseId: course.id, orderNum: lessonData.orderNum },
      });
      if (lesson) {
        lesson = await prisma.lesson.update({
          where: { id: lesson.id },
          data: { title: lessonData.title, subtitle: lessonData.subtitle },
        });
      } else if (!lesson) {
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
  console.log(
    `🌱 코스 시드 시작${FORCE ? ' (--force 모드)' : ''}${MISSING_ONLY ? ' (--missing-only)' : ''}${COURSE_FILTER !== null ? ` (--course=${COURSE_FILTER})` : ''}${LESSON_FILTER !== null ? ` (--lesson=${LESSON_FILTER})` : ''}\n`,
  );
  await seedCourses();
  console.log('\n🎉 시드 완료');
}

main()
  .catch((e) => {
    console.error('❌ 시드 실패:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
