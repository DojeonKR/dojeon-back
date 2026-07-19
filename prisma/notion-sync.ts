/**
 * Notion → DB 동기화 (1단계: 레슨 메타 + Vocabulary)
 *
 * 노션 "Curriculum" 데이터베이스의 각 행(레슨)을 읽어서
 * Course / Lesson / Section(VOCAB) / SectionCard 를 DB에 반영합니다.
 *
 * 실행:
 *   npm run prisma:notion-sync                # Status=Written 인 레슨만 동기화 (Vocabulary 카드 교체)
 *   npm run prisma:notion-sync -- --include-planned   # Planned 레슨도 포함
 *   npm run prisma:notion-sync -- --safe      # 이미 카드가 있는 섹션은 건너뜀 (덮어쓰지 않음)
 *   npm run prisma:notion-sync -- --dry-run   # DB에 쓰지 않고 무엇을 할지 출력만
 *
 * 필요한 환경변수 (.env):
 *   NOTION_TOKEN            = 노션 내부 통합(secret_...) 토큰
 *   NOTION_CURRICULUM_DB_ID = Curriculum 데이터베이스 ID (32자리 hex)
 *
 * 매핑 규칙:
 *   - LessonID(예: "C01L01") → 코스 번호 1, 레슨 번호 1
 *   - Course(select, 예: "Course 1") → 코스 제목
 *   - Grammar/Forms(text) → 레슨 subtitle
 *   - 레슨 페이지 안의 "Vocabulary" 표 → VOCAB 섹션의 카드
 *       표 컬럼: Korean word | English translation | English notes | Hebrew translation | Hebrew notes
 *
 * 주의:
 *   - 기본 모드는 Vocabulary 카드를 교체(삭제 후 재생성)합니다.
 *     해당 카드를 스크랩한 사용자의 Scrap.cardId 는 null 로 바뀝니다.
 *     이를 피하려면 --safe 로 실행하세요.
 *   - 1단계는 Vocabulary 만 동기화합니다. 문법/읽기/듣기는 동기화하지 않습니다.
 */

import { Client, isFullBlock, isFullPage } from '@notionhq/client';
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const INCLUDE_PLANNED = process.argv.includes('--include-planned');
const SAFE = process.argv.includes('--safe');
const DRY_RUN = process.argv.includes('--dry-run');

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_CURRICULUM_DB_ID = process.env.NOTION_CURRICULUM_DB_ID;

const VOCAB_HEADING_RE = /vocab|어휘|단어/i;

interface VocabCard {
  sequence: number;
  wordFront: string;
  wordBack: string;
  notes: string | null;
  locales: Record<string, { back: string; notes: string | null }> | null;
}

interface LessonRow {
  pageId: string;
  lessonCode: string;
  courseNum: number;
  lessonNum: number;
  courseTitle: string;
  subtitle: string | null;
  status: string | null;
}

/** Notion rich_text 배열 → 평문 문자열 */
function plainText(rich: Array<{ plain_text?: string }> | undefined): string {
  if (!rich || rich.length === 0) return '';
  return rich
    .map((r) => r.plain_text ?? '')
    .join('')
    .trim();
}

/** 셀(rich_text 배열) → null 가능 문자열 */
function cellText(cell: Array<{ plain_text?: string }> | undefined): string | null {
  const t = plainText(cell);
  return t.length > 0 ? t : null;
}

function getPropPlainText(page: any, propName: string): string {
  const prop = page.properties?.[propName];
  if (!prop) return '';
  switch (prop.type) {
    case 'title':
      return plainText(prop.title);
    case 'rich_text':
      return plainText(prop.rich_text);
    case 'select':
      return prop.select?.name ?? '';
    case 'status':
      return prop.status?.name ?? '';
    case 'multi_select':
      return (prop.multi_select ?? []).map((s: any) => s.name).join(', ');
    default:
      return '';
  }
}

/** "C01L01" → { courseNum: 1, lessonNum: 1 } */
function parseLessonCode(code: string): { courseNum: number; lessonNum: number } | null {
  const m = code.match(/C\s*(\d+)\s*L\s*(\d+)/i);
  if (!m) return null;
  return { courseNum: parseInt(m[1], 10), lessonNum: parseInt(m[2], 10) };
}

/** "Course 1" → 1 (fallback 용; 주 매핑은 LessonID 사용) */
function parseCourseNum(courseTitle: string): number | null {
  const m = courseTitle.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

/** 데이터베이스의 모든 행(page)을 페이지네이션하며 가져온다 */
async function queryAllRows(notion: Client, databaseId: string): Promise<any[]> {
  const rows: any[] = [];
  let cursor: string | undefined = undefined;
  do {
    const res: any = await notion.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
      page_size: 100,
    });
    rows.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return rows;
}

/** 블록의 자식 블록 전체를 페이지네이션하며 가져온다 */
async function getChildren(notion: Client, blockId: string): Promise<any[]> {
  const blocks: any[] = [];
  let cursor: string | undefined = undefined;
  do {
    const res: any = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100,
    });
    blocks.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return blocks;
}

/** 블록의 표시 텍스트(heading/toggle/paragraph 등) 추출 */
function blockPlainText(block: any): string {
  const t = block.type;
  const payload = block[t];
  if (payload?.rich_text) return plainText(payload.rich_text);
  return '';
}

function isHeadingLike(block: any): boolean {
  return ['heading_1', 'heading_2', 'heading_3', 'toggle'].includes(block.type);
}

/**
 * 레슨 페이지에서 Vocabulary 표(table 블록)를 찾는다.
 * 1) "Vocabulary" 류 heading/toggle 의 자식에서 table 탐색
 * 2) 못 찾으면 해당 heading 다음 형제 블록들(다음 heading 전까지)에서 table 탐색
 */
async function findVocabTable(notion: Client, pageId: string): Promise<any | null> {
  const topBlocks = await getChildren(notion, pageId);

  for (let i = 0; i < topBlocks.length; i++) {
    const block = topBlocks[i];
    if (!isFullBlock(block)) continue;
    const text = blockPlainText(block);
    if (!(isHeadingLike(block) && VOCAB_HEADING_RE.test(text))) continue;

    // 1) 자식(토글형 heading) 내부 탐색
    if (block.has_children) {
      const table = await findTableDeep(notion, block.id);
      if (table) return table;
    }

    // 2) 다음 형제들에서 탐색 (다음 heading 전까지)
    for (let j = i + 1; j < topBlocks.length; j++) {
      const sib = topBlocks[j];
      if (isHeadingLike(sib)) break;
      if (sib.type === 'table') return sib;
      if (sib.has_children) {
        const table = await findTableDeep(notion, sib.id);
        if (table) return table;
      }
    }
  }

  return null;
}

/** 블록 트리를 DFS 하며 첫 table 블록을 찾는다 */
async function findTableDeep(notion: Client, blockId: string): Promise<any | null> {
  const children = await getChildren(notion, blockId);
  for (const child of children) {
    if (child.type === 'table') return child;
  }
  for (const child of children) {
    if (child.has_children) {
      const found = await findTableDeep(notion, child.id);
      if (found) return found;
    }
  }
  return null;
}

/** Vocabulary table 블록 → 카드 배열 */
async function parseVocabCards(notion: Client, tableBlock: any): Promise<VocabCard[]> {
  const hasHeader = tableBlock.table?.has_column_header ?? true;
  const rows = await getChildren(notion, tableBlock.id);
  const tableRows = rows.filter((r) => r.type === 'table_row');
  if (tableRows.length === 0) return [];

  // 헤더 행으로 컬럼 인덱스 매핑
  let headerCells: string[];
  let dataRows: any[];
  if (hasHeader) {
    headerCells = (tableRows[0].table_row.cells as any[]).map((c) => plainText(c).toLowerCase());
    dataRows = tableRows.slice(1);
  } else {
    // 헤더가 없으면 표준 순서 가정
    headerCells = ['korean', 'english translation', 'english notes', 'hebrew translation', 'hebrew notes'];
    dataRows = tableRows;
  }

  const findCol = (...patterns: RegExp[]): number =>
    headerCells.findIndex((h) => patterns.some((p) => p.test(h)));

  const colFront = findCol(/korean|한국/);
  const colBack = findCol(/english\s*trans|영어|^en$/);
  const colNotes = findCol(/english\s*note/);
  const colHeBack = findCol(/hebrew\s*trans|히브리/);
  const colHeNotes = findCol(/hebrew\s*note/);

  const cards: VocabCard[] = [];
  let seq = 0;
  for (const row of dataRows) {
    const cells: any[] = row.table_row.cells;
    const wordFront = colFront >= 0 ? cellText(cells[colFront]) : cellText(cells[0]);
    const wordBack = colBack >= 0 ? cellText(cells[colBack]) : cellText(cells[1]);
    // 앞/뒤 둘 다 비어 있으면 빈 행으로 보고 건너뜀
    if (!wordFront && !wordBack) continue;

    const notes = colNotes >= 0 ? cellText(cells[colNotes]) : null;
    const heBack = colHeBack >= 0 ? cellText(cells[colHeBack]) : null;
    const heNotes = colHeNotes >= 0 ? cellText(cells[colHeNotes]) : null;

    seq += 1;
    cards.push({
      sequence: seq,
      wordFront: wordFront ?? '',
      wordBack: wordBack ?? '',
      notes,
      locales: heBack || heNotes ? { he: { back: heBack ?? '', notes: heNotes } } : null,
    });
  }
  return cards;
}

async function upsertCourse(courseNum: number, title: string): Promise<number> {
  const existing = await prisma.course.findFirst({ where: { orderNum: courseNum } });
  if (existing) {
    if (existing.title !== title) {
      await prisma.course.update({ where: { id: existing.id }, data: { title } });
    }
    return existing.id;
  }
  const created = await prisma.course.create({
    data: { title, description: null, orderNum: courseNum, isActive: true },
  });
  return created.id;
}

async function upsertLesson(
  courseId: number,
  lessonNum: number,
  subtitle: string | null,
): Promise<number> {
  const title = `Lesson ${lessonNum}`;
  const existing = await prisma.lesson.findFirst({ where: { courseId, orderNum: lessonNum } });
  if (existing) {
    await prisma.lesson.update({ where: { id: existing.id }, data: { title, subtitle } });
    return existing.id;
  }
  const created = await prisma.lesson.create({
    data: { courseId, title, subtitle, orderNum: lessonNum },
  });
  return created.id;
}

/** VOCAB 섹션 + 카드 동기화. 반환: 반영한 카드 수 (-1 = skip) */
async function syncVocabSection(lessonId: number, cards: VocabCard[]): Promise<number> {
  const VOCAB_ORDER = 1;
  let section = await prisma.section.findFirst({
    where: { lessonId, orderNum: VOCAB_ORDER },
  });

  if (section) {
    await prisma.section.update({
      where: { id: section.id },
      data: { type: 'VOCAB', title: 'Vocabulary', totalPages: cards.length },
    });
  } else {
    section = await prisma.section.create({
      data: { lessonId, type: 'VOCAB', title: 'Vocabulary', orderNum: VOCAB_ORDER, totalPages: cards.length },
    });
  }

  const existingCards = await prisma.sectionCard.count({ where: { sectionId: section.id } });
  if (existingCards > 0 && SAFE) {
    return -1;
  }

  if (existingCards > 0) {
    await prisma.sectionCard.deleteMany({ where: { sectionId: section.id } });
  }

  if (cards.length > 0) {
    await prisma.sectionCard.createMany({
      data: cards.map((c) => ({
        sectionId: section!.id,
        sequence: c.sequence,
        wordFront: c.wordFront,
        wordBack: c.wordBack,
        notes: c.notes,
        locales:
          c.locales && Object.keys(c.locales).length > 0
            ? (c.locales as Prisma.InputJsonValue)
            : undefined,
        audioUrl: null,
      })),
    });
  }

  return cards.length;
}

function toLessonRow(page: any): LessonRow | null {
  if (!isFullPage(page)) return null;
  const lessonCode = getPropPlainText(page, 'LessonID').trim();
  const parsed = parseLessonCode(lessonCode);
  if (!parsed) return null;

  const courseTitle = getPropPlainText(page, 'Course').trim() || `Course ${parsed.courseNum}`;
  const subtitleRaw = getPropPlainText(page, 'Grammar/Forms').trim();
  const status = getPropPlainText(page, 'Status').trim() || null;

  // LessonID 의 코스번호와 Course 속성이 어긋나면 LessonID 를 신뢰
  const courseNumFromTitle = parseCourseNum(courseTitle);
  const courseNum = parsed.courseNum || courseNumFromTitle || 1;

  return {
    pageId: page.id,
    lessonCode,
    courseNum,
    lessonNum: parsed.lessonNum,
    courseTitle,
    subtitle: subtitleRaw.length > 0 ? subtitleRaw : null,
    status,
  };
}

async function main() {
  if (!NOTION_TOKEN) {
    throw new Error('환경변수 NOTION_TOKEN 이 설정되지 않았습니다. .env 를 확인하세요.');
  }
  if (!NOTION_CURRICULUM_DB_ID) {
    throw new Error('환경변수 NOTION_CURRICULUM_DB_ID 가 설정되지 않았습니다. .env 를 확인하세요.');
  }

  const notion = new Client({ auth: NOTION_TOKEN });

  console.log(
    `🔄 Notion 동기화 시작 (1단계: 레슨 + Vocabulary)` +
      `${DRY_RUN ? ' [dry-run]' : ''}${SAFE ? ' [safe]' : ''}${INCLUDE_PLANNED ? ' [include-planned]' : ''}\n`,
  );

  const rawRows = await queryAllRows(notion, NOTION_CURRICULUM_DB_ID);
  const lessons = rawRows
    .map(toLessonRow)
    .filter((r): r is LessonRow => r !== null)
    .filter((r) => INCLUDE_PLANNED || (r.status ?? '').toLowerCase() === 'written')
    .sort((a, b) => a.courseNum - b.courseNum || a.lessonNum - b.lessonNum);

  console.log(`📋 대상 레슨 ${lessons.length}개 (전체 행 ${rawRows.length}개)\n`);

  let okCount = 0;
  let skipCount = 0;
  let noVocabCount = 0;

  for (const lesson of lessons) {
    const label = `${lesson.lessonCode} (코스 ${lesson.courseNum} / 레슨 ${lesson.lessonNum})`;

    const tableBlock = await findVocabTable(notion, lesson.pageId);
    if (!tableBlock) {
      console.log(`  ⚠️  ${label} — Vocabulary 표를 찾지 못함 (레슨 메타만 반영)`);
      noVocabCount += 1;
    }

    const cards = tableBlock ? await parseVocabCards(notion, tableBlock) : [];

    if (DRY_RUN) {
      console.log(`  🔍 ${label} — "${lesson.courseTitle}" / subtitle="${lesson.subtitle ?? ''}" / 카드 ${cards.length}개`);
      continue;
    }

    const courseId = await upsertCourse(lesson.courseNum, lesson.courseTitle);
    const lessonId = await upsertLesson(courseId, lesson.lessonNum, lesson.subtitle);

    if (tableBlock) {
      const result = await syncVocabSection(lessonId, cards);
      if (result === -1) {
        console.log(`  ⏭  ${label} — 이미 카드 있음 (--safe, 건너뜀)`);
        skipCount += 1;
      } else {
        console.log(`  ✅ ${label} — Vocabulary 카드 ${result}개 반영`);
        okCount += 1;
      }
    }
  }

  console.log(
    `\n🎉 동기화 완료 — 반영 ${okCount}개, 건너뜀 ${skipCount}개, Vocabulary 없음 ${noVocabCount}개` +
      `${DRY_RUN ? ' (dry-run: DB 변경 없음)' : ''}`,
  );
}

main()
  .catch((e) => {
    console.error('❌ Notion 동기화 실패:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
