/**
 * prisma/data JSON 구조 검증 (DB 없이 실행 가능)
 * 실행: node prisma/validate-data.js
 */
const fs = require('fs');
const path = require('path');

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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validateSection(section, filePath) {
  assert(section.type, `${filePath}: type required`);
  assert(section.title, `${filePath}: title required`);
  assert(typeof section.orderNum === 'number', `${filePath}: orderNum required`);
  assert(typeof section.totalPages === 'number', `${filePath}: totalPages required`);
  assert(Array.isArray(section.cards), `${filePath}: cards must be array`);
  assert(Array.isArray(section.materials), `${filePath}: materials must be array`);
  assert(Array.isArray(section.questions), `${filePath}: questions must be array`);

  for (const material of section.materials) {
    assert(typeof material.sequence === 'number', `${filePath}: material.sequence required`);
    assert(typeof material.type === 'string', `${filePath}: material.type required`);
    assert(typeof material.isExtra === 'boolean', `${filePath}: material.isExtra required`);
    assert(
      material.contentText && typeof material.contentText === 'object',
      `${filePath}: material.contentText required`,
    );
  }
}

function main() {
  assert(fs.existsSync(DATA_DIR), 'prisma/data 폴더가 없습니다.');

  const summary = {
    courses: 0,
    activeCourses: 0,
    inactiveCourses: 0,
    lessons: 0,
    sections: 0,
    cards: 0,
    materials: 0,
    byCourse: {},
  };

  for (const courseFolder of getSortedDirs(DATA_DIR)) {
    const courseDir = path.join(DATA_DIR, courseFolder);
    const courseJsonPath = path.join(courseDir, 'course.json');
    if (!fs.existsSync(courseJsonPath)) continue;

    const course = readJson(courseJsonPath);
    assert(course.title, `${courseJsonPath}: title required`);
    assert(typeof course.orderNum === 'number', `${courseJsonPath}: orderNum required`);
    assert(typeof course.isActive === 'boolean', `${courseJsonPath}: isActive required`);

    summary.courses += 1;
    if (course.isActive) summary.activeCourses += 1;
    else summary.inactiveCourses += 1;

    summary.byCourse[courseFolder] = { lessons: 0, sections: 0 };

    for (const lessonFolder of getSortedDirs(courseDir)) {
      const lessonDir = path.join(courseDir, lessonFolder);
      const lessonJsonPath = path.join(lessonDir, 'lesson.json');
      if (!fs.existsSync(lessonJsonPath)) continue;

      const lesson = readJson(lessonJsonPath);
      assert(lesson.title, `${lessonJsonPath}: title required`);
      assert(typeof lesson.orderNum === 'number', `${lessonJsonPath}: orderNum required`);
      summary.lessons += 1;
      summary.byCourse[courseFolder].lessons += 1;

      for (const sectionFile of getSectionFiles(lessonDir)) {
        const sectionPath = path.join(lessonDir, sectionFile);
        const section = readJson(sectionPath);
        validateSection(section, sectionPath);
        summary.sections += 1;
        summary.byCourse[courseFolder].sections += 1;
        summary.cards += section.cards.length;
        summary.materials += section.materials.length;
      }
    }
  }

  assert(summary.courses >= 1, '최소 1개 코스가 필요합니다.');

  console.log('✅ prisma/data 검증 통과');
  console.log(`   코스: ${summary.courses} (활성 ${summary.activeCourses}, 비활성 ${summary.inactiveCourses})`);
  console.log(`   레슨: ${summary.lessons}, 섹션: ${summary.sections}`);
  console.log(`   카드: ${summary.cards}, 머티리얼: ${summary.materials}`);
  console.log('');
  console.log('코스별 요약:');
  for (const [course, stats] of Object.entries(summary.byCourse)) {
    console.log(`   ${course}: 레슨 ${stats.lessons}, 섹션 ${stats.sections}`);
  }
}

try {
  main();
} catch (e) {
  console.error('❌ 검증 실패:', e.message);
  process.exit(1);
}
