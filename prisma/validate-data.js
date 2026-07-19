/**
 * prisma/data JSON 구조 검증 (DB 없이 실행 가능)
 * 실행: node prisma/validate-data.js
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const APP_DATA_PATH = path.join(DATA_DIR, 'app-data.json');

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

  for (const question of section.questions) {
    assert(typeof question.type === 'string', `${filePath}: question.type required`);
    assert(
      typeof question.questionText === 'string',
      `${filePath}: question.questionText required`,
    );
    assert(Array.isArray(question.options), `${filePath}: question.options must be array`);
    assert(typeof question.answer === 'string', `${filePath}: question.answer required`);
  }
}

function validateAppData() {
  assert(fs.existsSync(APP_DATA_PATH), `${APP_DATA_PATH}: file required`);
  const appData = readJson(APP_DATA_PATH);
  assert(Array.isArray(appData.badges), `${APP_DATA_PATH}: badges must be array`);
  assert(
    Array.isArray(appData.subscriptionPlans),
    `${APP_DATA_PATH}: subscriptionPlans must be array`,
  );
  assert(appData.badges.length === 18, `${APP_DATA_PATH}: exactly 18 badges required`);
  assert(
    appData.badges[0]?.key === 'signed_up',
    `${APP_DATA_PATH}: signed_up must be the first badge`,
  );
  assert(
    new Set(appData.badges.map((badge) => badge.key)).size === appData.badges.length,
    `${APP_DATA_PATH}: badge keys must be unique`,
  );

  const expectedUsdPrices = new Map([
    ['pro', 15],
    ['pro-3month', 39],
    ['pro-6month', 69],
    ['annual', 99],
  ]);
  for (const [planId, priceUsd] of expectedUsdPrices) {
    const plan = appData.subscriptionPlans.find((candidate) => candidate.id === planId);
    assert(plan, `${APP_DATA_PATH}: ${planId} plan required`);
    assert(plan.priceUsd === priceUsd, `${APP_DATA_PATH}: ${planId} must cost $${priceUsd}`);
  }

  return appData;
}

function main() {
  assert(fs.existsSync(DATA_DIR), 'prisma/data 폴더가 없습니다.');
  const appData = validateAppData();

  const summary = {
    courses: 0,
    activeCourses: 0,
    inactiveCourses: 0,
    lessons: 0,
    sections: 0,
    cards: 0,
    materials: 0,
    questions: 0,
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

      let grammarNumber = 0;
      const sectionFiles = getSectionFiles(lessonDir);
      for (const sectionFile of sectionFiles) {
        const sectionPath = path.join(lessonDir, sectionFile);
        const section = readJson(sectionPath);
        validateSection(section, sectionPath);

        const expectedTitle =
          section.type === 'VOCAB'
            ? 'Vocabulary'
            : section.type === 'GRAMMAR'
              ? `Grammar ${++grammarNumber}`
              : section.type === 'READING'
                ? 'Reading'
                : section.type === 'LISTENING'
                  ? 'Listening'
                  : section.title;
        assert(
          section.title === expectedTitle,
          `${sectionPath}: section title must be "${expectedTitle}"`,
        );

        summary.sections += 1;
        summary.byCourse[courseFolder].sections += 1;
        summary.cards += section.cards.length;
        summary.materials += section.materials.length;
        summary.questions += section.questions.length;
      }

      if (courseFolder === 'course-01' && lessonFolder === 'lesson-03') {
        assert(sectionFiles.length === 5, `${lessonDir}: exactly 5 sections required`);
        const sections = sectionFiles.map((file) => readJson(path.join(lessonDir, file)));
        assert(sections[0].cards.length === 25, `${lessonDir}: 25 vocabulary cards required`);
        assert(
          sections[1].materials[0]?.contentText?.title === '아/어/해요',
          `${lessonDir}: Grammar 1 must contain 아/어/해요`,
        );
        assert(
          sections[2].materials[0]?.contentText?.title === '을/를',
          `${lessonDir}: Grammar 2 must contain 을/를`,
        );
        assert(
          JSON.stringify(sections[2]).includes('Bern ssi, do you learn Korean?'),
          `${lessonDir}: corrected Bern dialogue required`,
        );
        assert(
          sections[4].materials[0]?.contentText?.audioUnavailable === true &&
            !sections[4].materials[0]?.contentText?.audioUrl,
          `${lessonDir}: Listening must use text fallback without audio`,
        );
      }

      if (courseFolder === 'course-01' && lessonFolder === 'lesson-04') {
        assert(sectionFiles.length === 5, `${lessonDir}: exactly 5 sections required`);
        const sections = sectionFiles.map((file) => readJson(path.join(lessonDir, file)));
        assert(sections[0].cards.length === 14, `${lessonDir}: 14 vocabulary cards required`);
        assert(
          sections[1].materials[0]?.contentText?.title === '이/가 아니에요',
          `${lessonDir}: Grammar 1 must contain 이/가 아니에요`,
        );
        assert(
          sections[2].materials[0]?.contentText?.title === '안',
          `${lessonDir}: Grammar 2 must contain 안`,
        );
        assert(
          sections[4].materials[0]?.contentText?.audioUnavailable === true &&
            !sections[4].materials[0]?.contentText?.audioUrl,
          `${lessonDir}: Listening must use text fallback without audio`,
        );
      }

      if (courseFolder === 'course-01' && lessonFolder === 'lesson-05') {
        assert(sectionFiles.length === 5, `${lessonDir}: exactly 5 sections required`);
        const sections = sectionFiles.map((file) => readJson(path.join(lessonDir, file)));
        assert(sections[0].cards.length === 24, `${lessonDir}: 24 vocabulary cards required`);
        assert(
          sections[1].materials[0]?.contentText?.title === '아/어/했어요',
          `${lessonDir}: Grammar 1 must contain 아/어/했어요`,
        );
        assert(
          sections[2].materials[0]?.contentText?.title === '‘ㅂ’ 불규칙',
          `${lessonDir}: Grammar 2 must contain ‘ㅂ’ 불규칙`,
        );
        assert(
          sections[4].materials[0]?.contentText?.audioUnavailable === true &&
            !sections[4].materials[0]?.contentText?.audioUrl,
          `${lessonDir}: Listening must use text fallback without audio`,
        );
      }

      if (courseFolder === 'course-01' && lessonFolder === 'lesson-06') {
        assert(sectionFiles.length === 5, `${lessonDir}: exactly 5 sections required`);
        const sections = sectionFiles.map((file) => readJson(path.join(lessonDir, file)));
        assert(sections[0].cards.length === 12, `${lessonDir}: 12 vocabulary cards required`);
        assert(
          sections[1].materials[0]?.contentText?.title === '을 거예요',
          `${lessonDir}: Grammar 1 must contain 을 거예요`,
        );
        assert(
          sections[2].materials[0]?.contentText?.title === '하고 (같이)',
          `${lessonDir}: Grammar 2 must contain 하고 (같이)`,
        );
        assert(
          sections[4].materials[0]?.contentText?.audioUnavailable === true &&
            !sections[4].materials[0]?.contentText?.audioUrl,
          `${lessonDir}: Listening must use text fallback without audio`,
        );
      }

      if (courseFolder === 'course-01' && lessonFolder === 'lesson-07') {
        assert(sectionFiles.length === 5, `${lessonDir}: exactly 5 sections required`);
        const sections = sectionFiles.map((file) => readJson(path.join(lessonDir, file)));
        assert(sections[0].cards.length === 14, `${lessonDir}: 14 vocabulary cards required`);
        assert(
          sections[1].materials[0]?.contentText?.title === '에1',
          `${lessonDir}: Grammar 1 must contain 에1`,
        );
        assert(
          sections[2].materials[0]?.contentText?.title === '에서',
          `${lessonDir}: Grammar 2 must contain 에서`,
        );
        assert(
          sections[4].materials[0]?.contentText?.audioUnavailable === true &&
            !sections[4].materials[0]?.contentText?.audioUrl,
          `${lessonDir}: Listening must use text fallback without audio`,
        );
      }

      if (courseFolder === 'course-01' && lessonFolder === 'lesson-08') {
        assert(sectionFiles.length === 5, `${lessonDir}: exactly 5 sections required`);
        const sections = sectionFiles.map((file) => readJson(path.join(lessonDir, file)));
        assert(sections[0].cards.length === 33, `${lessonDir}: 33 vocabulary cards required`);
        assert(
          sections[1].materials[0]?.contentText?.title === '몇',
          `${lessonDir}: Grammar 1 must contain 몇`,
        );
        assert(
          sections[2].materials[0]?.contentText?.title === '에2',
          `${lessonDir}: Grammar 2 must contain 에2`,
        );
        assert(
          sections[4].materials[0]?.contentText?.audioUnavailable === true &&
            !sections[4].materials[0]?.contentText?.audioUrl,
          `${lessonDir}: Listening must use text fallback without audio`,
        );
      }

      if (courseFolder === 'course-01' && lessonFolder === 'lesson-09') {
        assert(sectionFiles.length === 5, `${lessonDir}: exactly 5 sections required`);
        const sections = sectionFiles.map((file) => readJson(path.join(lessonDir, file)));
        assert(sections[0].cards.length === 34, `${lessonDir}: 34 vocabulary cards required`);
        assert(sections[1].materials.length === 2, `${lessonDir}: Grammar 1 needs two materials`);
        assert(
          sections[1].materials[0]?.contentText?.title === '시간' &&
            sections[1].materials[1]?.contentText?.title === '에3',
          `${lessonDir}: Grammar 1 must contain 시간 and 에3`,
        );
        assert(
          sections[2].materials[0]?.contentText?.title === '고',
          `${lessonDir}: Grammar 2 must contain 고`,
        );
        assert(
          sections[4].materials[0]?.contentText?.audioUnavailable === true &&
            !sections[4].materials[0]?.contentText?.audioUrl,
          `${lessonDir}: Listening must use text fallback without audio`,
        );
      }

      if (courseFolder === 'course-01' && lessonFolder === 'lesson-10') {
        assert(sectionFiles.length === 5, `${lessonDir}: exactly 5 sections required`);
        const sections = sectionFiles.map((file) => readJson(path.join(lessonDir, file)));
        assert(sections[0].cards.length === 19, `${lessonDir}: 19 vocabulary cards required`);
        assert(
          sections[1].materials[0]?.contentText?.title === '부터 까지',
          `${lessonDir}: Grammar 1 must contain 부터 까지`,
        );
        assert(
          sections[2].materials[0]?.contentText?.title === '부터 까지',
          `${lessonDir}: Grammar 2 must contain 부터 까지 writing practice`,
        );
        assert(
          sections[4].materials[0]?.contentText?.audioUnavailable === true &&
            !sections[4].materials[0]?.contentText?.audioUrl,
          `${lessonDir}: Listening must use text fallback without audio`,
        );
      }

      if (courseFolder === 'course-01' && lessonFolder === 'lesson-11') {
        assert(sectionFiles.length === 5, `${lessonDir}: exactly 5 sections required`);
        const sections = sectionFiles.map((file) => readJson(path.join(lessonDir, file)));
        assert(sections[0].cards.length === 19, `${lessonDir}: 19 vocabulary cards required`);
        assert(
          sections[1].materials[0]?.contentText?.title === '을게요',
          `${lessonDir}: Grammar 1 must contain 을게요`,
        );
        assert(
          sections[2].materials[0]?.contentText?.title === '을 수 있다/없다',
          `${lessonDir}: Grammar 2 must contain 을 수 있다/없다`,
        );
        assert(
          sections[4].materials[0]?.contentText?.audioUnavailable === true &&
            !sections[4].materials[0]?.contentText?.audioUrl,
          `${lessonDir}: Listening must use text fallback without audio`,
        );
      }

      if (courseFolder === 'course-01' && lessonFolder === 'lesson-12') {
        assert(sectionFiles.length === 5, `${lessonDir}: exactly 5 sections required`);
        const sections = sectionFiles.map((file) => readJson(path.join(lessonDir, file)));
        assert(sections[0].cards.length === 17, `${lessonDir}: 17 vocabulary cards required`);
        assert(
          sections[1].materials[0]?.contentText?.title === '읍시다/지 맙시다',
          `${lessonDir}: Grammar 1 must contain 읍시다/지 맙시다`,
        );
        assert(
          sections[2].materials[0]?.contentText?.title === '을까요?',
          `${lessonDir}: Grammar 2 must contain 을까요?`,
        );
        assert(
          sections[3].materials[0]?.contentText?.questions?.length === 3,
          `${lessonDir}: Reading must contain 3 questions`,
        );
        assert(
          sections[4].materials[0]?.contentText?.audioUnavailable === true &&
            !sections[4].materials[0]?.contentText?.audioUrl,
          `${lessonDir}: Listening must use text fallback without audio`,
        );
      }

      if (courseFolder === 'course-01' && lessonFolder === 'lesson-13') {
        assert(sectionFiles.length === 5, `${lessonDir}: exactly 5 sections required`);
        const sections = sectionFiles.map((file) => readJson(path.join(lessonDir, file)));
        assert(sections[0].cards.length === 20, `${lessonDir}: 20 vocabulary cards required`);
        assert(
          sections[1].materials[0]?.contentText?.title === '고 싶다',
          `${lessonDir}: Grammar 1 must contain 고 싶다`,
        );
        assert(
          sections[2].materials[0]?.contentText?.title === '으면',
          `${lessonDir}: Grammar 2 must contain 으면`,
        );
        assert(
          sections[3].materials[0]?.contentText?.questions?.length === 3,
          `${lessonDir}: Reading must contain 3 questions`,
        );
        assert(
          sections[4].materials[0]?.contentText?.audioUnavailable === true &&
            !sections[4].materials[0]?.contentText?.audioUrl,
          `${lessonDir}: Listening must use text fallback without audio`,
        );
      }

      if (courseFolder === 'course-01' && lessonFolder === 'lesson-14') {
        assert(sectionFiles.length === 5, `${lessonDir}: exactly 5 sections required`);
        const sections = sectionFiles.map((file) => readJson(path.join(lessonDir, file)));
        assert(sections[0].cards.length === 24, `${lessonDir}: 24 vocabulary cards required`);
        assert(
          sections[1].materials[0]?.contentText?.title === '지만',
          `${lessonDir}: Grammar 1 must contain 지만`,
        );
        assert(sections[2].materials.length === 2, `${lessonDir}: Grammar 2 needs two materials`);
        assert(
          sections[2].materials[0]?.contentText?.title === '(으)니까' &&
            sections[2].materials[1]?.contentText?.title === '-기',
          `${lessonDir}: Grammar 2 must contain (으)니까 and -기`,
        );
        assert(
          sections[3].materials[0]?.contentText?.questions?.length === 3,
          `${lessonDir}: Reading must contain 3 questions`,
        );
        assert(
          sections[4].materials[0]?.contentText?.audioUnavailable === true &&
            !sections[4].materials[0]?.contentText?.audioUrl,
          `${lessonDir}: Listening must use text fallback without audio`,
        );
      }

      if (courseFolder === 'course-01' && lessonFolder === 'lesson-15') {
        assert(sectionFiles.length === 5, `${lessonDir}: exactly 5 sections required`);
        const sections = sectionFiles.map((file) => readJson(path.join(lessonDir, file)));
        assert(sections[0].cards.length === 26, `${lessonDir}: 26 vocabulary cards required`);
        assert(sections[1].materials.length === 2, `${lessonDir}: Grammar 1 needs two materials`);
        assert(
          sections[1].materials[0]?.contentText?.title === '지 않다' &&
            sections[1].materials[1]?.contentText?.title === '으세요/-지 마세요',
          `${lessonDir}: Grammar 1 must contain 지 않다 and 으세요/-지 마세요`,
        );
        assert(
          sections[2].materials[0]?.contentText?.title === '‘ㄷ’ 불규칙',
          `${lessonDir}: Grammar 2 must contain ‘ㄷ’ 불규칙`,
        );
        assert(
          sections[3].materials[0]?.contentText?.questions?.length === 3,
          `${lessonDir}: Reading must contain 3 questions`,
        );
        assert(
          sections[4].materials[0]?.contentText?.audioUnavailable === true &&
            !sections[4].materials[0]?.contentText?.audioUrl,
          `${lessonDir}: Listening must use text fallback without audio`,
        );
      }
    }
  }

  assert(summary.courses >= 1, '최소 1개 코스가 필요합니다.');

  console.log('✅ prisma/data 검증 통과');
  console.log(
    `   앱 데이터: 업적 ${appData.badges.length}개, 구독 플랜 ${appData.subscriptionPlans.length}개`,
  );
  console.log(
    `   코스: ${summary.courses} (활성 ${summary.activeCourses}, 비활성 ${summary.inactiveCourses})`,
  );
  console.log(`   레슨: ${summary.lessons}, 섹션: ${summary.sections}`);
  console.log(
    `   카드: ${summary.cards}, 머티리얼: ${summary.materials}, 문제: ${summary.questions}`,
  );
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
