import { Body, Controller, Get, Param, ParseIntPipe, Post, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { LogService } from './log.service';
import { CurrentUser, JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { SectionProgressDto } from './dto/section-progress.dto';
import { CheckSectionQuestionDto } from './dto/check-section-question.dto';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';
import { successExample, errorExample } from '../../common/swagger/swagger-response.helper';

@ApiTags('섹션 (Section)')
@ApiBearerAuth('access-token')
@Controller('section')
export class SectionsController {
  constructor(private readonly logService: LogService) {}

  @ApiOperation({ summary: '섹션 학습 자료 목록', description: '섹션의 문법 자료(GRAMMAR_TABLE 등) 목록을 반환합니다.' })
  @ApiParam({ name: 'sectionId', description: '섹션 ID', example: 5 })
  @ApiResponse({
    status: 200,
    description: '학습 자료 목록 — Prisma `SectionMaterial` 필드 그대로(`id`, `type`, `contentText`, `sequence` 등). `materialId`라는 이름은 사용하지 않습니다.',
    schema: {
      example: successExample({
        sectionId: 5,
        courseId: 1,
        lessonId: 2,
        materials: [
          {
            id: 1,
            type: 'GRAMMAR_TABLE',
            sequence: 1,
            isExtra: false,
            contentText: {
              title: '동사 + 아요/어요',
              explanations: [
                { lang: 'en', text: 'A verb ending used to form polite present tense sentences.' },
                { lang: 'he', text: 'סיומת פועל המשמשת ליצירת משפטים בזמן הווה מנומס.' },
              ],
              imageUrl: '',
              dialogues: [
                {
                  lines: [
                    { speaker: '가', ko: '뭐 해요?', en: 'What are you doing?', he: 'מה את/ה עושה?' },
                    { speaker: '나', ko: '밥 먹어요.', en: "I'm eating.", he: 'אני אוכל/ת.' },
                  ],
                },
              ],
            },
          },
        ],
      }),
    },
  })
  @ApiResponse({
    status: 404,
    description: '섹션 없음',
    schema: { example: errorExample('섹션을 찾을 수 없습니다.', 404, 'SECTION_NOT_FOUND') },
  })
  @Get(':sectionId/material')
  async materials(@Param('sectionId', ParseIntPipe) sectionId: number) {
    return this.logService.getSectionMaterialsList(sectionId);
  }

  @ApiOperation({
    summary: '섹션 단어 카드 목록',
    description:
      '섹션의 단어 카드 목록입니다. 한국어(`wordFront`), 기본 번역(`wordBack`, 영문), 보조 설명(`notes`), 로케일별 문자열(`locales`), 음원 URL을 포함합니다.',
  })
  @ApiParam({ name: 'sectionId', description: '섹션 ID', example: 5 })
  @ApiResponse({
    status: 200,
    description: '단어 카드 목록 — 최상위에 `sectionId` 포함',
    schema: {
      example: successExample({
        sectionId: 5,
        cards: [
          {
            id: 1,
            wordFront: '저',
            wordBack: 'I / me',
            notes: 'humble form used in polite speech',
            locales: { he: { back: 'אני', notes: 'צורת "אני" מנומסת' } },
            audioUrl: 'https://cdn.example.com/audio/1.mp3',
            sequence: 1,
            isScraped: false,
            scrapId: null,
          },
        ],
      }),
    },
  })
  @Get(':sectionId/card')
  async cards(@CurrentUser() user: JwtPayloadUser, @Param('sectionId', ParseIntPipe) sectionId: number) {
    return this.logService.getSectionCardsList(sectionId, user.userId);
  }

  @ApiOperation({ summary: '섹션 문제 목록', description: '섹션의 퀴즈/문제 목록을 반환합니다.' })
  @ApiParam({ name: 'sectionId', description: '섹션 ID', example: 5 })
  @ApiResponse({
    status: 200,
    description: '문제 목록 — `answer` 필드는 포함되지 않음',
    schema: {
      example: successExample({
        sectionId: 5,
        questions: [
          { id: 1, type: 'MCQ', questionText: '다음 중 "안녕하세요"의 의미로 옳은 것은?', options: ['Hello', 'Goodbye', 'Thank you', 'Sorry'], explanation: null },
        ],
      }),
    },
  })
  @Get(':sectionId/question')
  async questions(@Param('sectionId', ParseIntPipe) sectionId: number) {
    return this.logService.getSectionQuestionsList(sectionId);
  }

  @Throttle({ default: { limit: 45, ttl: 60000 } })
  @ApiOperation({
    summary: '섹션 문제 채점',
    description:
      '제출한 답을 서버에서 채점합니다. 정답일 때만 correctAnswer·explanation이 포함되고, 오답이면 { correct: false }만 반환합니다. 목록 API에는 정답이 없습니다.',
  })
  @ApiParam({ name: 'sectionId', description: '섹션 ID' })
  @ApiResponse({
    status: 200,
    description: '채점 결과 — 오답 시 `{ correct: false }`만',
    schema: {
      example: successExample({ correct: true, correctAnswer: 'Hello', explanation: null }),
    },
  })
  @ApiResponse({
    status: 404,
    description: '섹션 또는 해당 섹션에 없는 questionId',
    schema: { example: errorExample('문제를 찾을 수 없습니다.', 404, 'QUESTION_NOT_FOUND') },
  })
  @Post(':sectionId/questions/check')
  @ApiHeader({ name: 'Idempotency-Key', description: '중복 채점 카운트 방지용 요청 키', required: false })
  @UseInterceptors(IdempotencyInterceptor)
  async checkQuestion(
    @CurrentUser() user: JwtPayloadUser,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Body() dto: CheckSectionQuestionDto,
  ) {
    return this.logService.checkSectionQuestion(user.userId, sectionId, dto);
  }

  @ApiOperation({
    summary: '섹션 학습 진행 조회',
    description:
      '해당 섹션에 대한 사용자의 진행, 페이지별 체류 시간, Grammar 난이도 평가 및 전체 집계를 반환합니다.',
  })
  @ApiParam({ name: 'sectionId', description: '섹션 ID' })
  @ApiResponse({
    status: 200,
    schema: {
      example: successExample({
        sectionId: 5,
        currentPage: 5,
        isCompleted: true,
        stayTimeSeconds: 120,
        difficulty: 'NORMAL',
        pageStayTimes: [
          { pageNumber: 0, stayTimeSeconds: 20 },
          { pageNumber: 1, stayTimeSeconds: 35 },
        ],
        difficultyCounts: { easy: 3, normal: 8, hard: 2 },
      }),
    },
  })
  @Get(':sectionId/progress')
  async getProgress(@CurrentUser() user: JwtPayloadUser, @Param('sectionId', ParseIntPipe) sectionId: number) {
    return this.logService.getSectionProgressForUser(user.userId, sectionId);
  }

  @ApiOperation({
    summary: '섹션 학습 진행 저장',
    description:
      '`stayTimeSeconds`는 마지막 저장 이후의 증가분입니다. `pageNumber`를 함께 보내면 해당 페이지 체류 시간에도 누적됩니다. 난이도는 완료된 Grammar 섹션에만 저장되며 전체 집계도 함께 갱신됩니다. (Idempotency-Key 헤더 권장)',
  })
  @ApiParam({ name: 'sectionId', description: '섹션 ID', example: 5 })
  @ApiHeader({ name: 'Idempotency-Key', description: '중복 요청 방지 키 (UUID 권장)', required: false })
  @ApiResponse({
    status: 200,
    description:
      '진행 저장 성공 — 응답은 `sectionId`·`log`(currentPage, stayTimeSeconds, isCompleted, difficulty)·`nextSection`(마지막 섹션이면 null)입니다. 뱃지 획득 목록은 이 API 응답에 포함되지 않습니다.',
    schema: {
      example: successExample({
        sectionId: 5,
        log: { currentPage: 5, stayTimeSeconds: 120, isCompleted: true, difficulty: null },
        nextSection: {
          courseId: 1,
          lessonId: 2,
          sectionId: 6,
          type: 'VOCAB',
          title: '단어 카드',
        },
      }),
    },
  })
  @ApiResponse({
    status: 404,
    description: '섹션 없음',
    schema: { example: errorExample('섹션을 찾을 수 없습니다.', 404, 'SECTION_NOT_FOUND') },
  })
  @Post(':sectionId/progress')
  @UseInterceptors(IdempotencyInterceptor)
  async progress(
    @CurrentUser() user: JwtPayloadUser,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Body() dto: SectionProgressDto,
  ) {
    return this.logService.saveSectionProgress(user.userId, sectionId, dto);
  }
}
