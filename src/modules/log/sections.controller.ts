import { Body, Controller, Get, Param, ParseIntPipe, Post, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LogService } from './log.service';
import { CurrentUser, JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { SectionProgressDto } from './dto/section-progress.dto';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';
import { successExample } from '../../common/swagger/swagger-response.helper';

@ApiTags('섹션 (Section)')
@ApiBearerAuth('access-token')
@Controller('section')
export class SectionsController {
  constructor(private readonly logService: LogService) {}

  @ApiOperation({ summary: '섹션 학습 자료 목록', description: '섹션의 문법 자료(GRAMMAR_TABLE 등) 목록을 반환합니다.' })
  @ApiParam({ name: 'sectionId', description: '섹션 ID', example: 5 })
  @ApiResponse({
    status: 200,
    description: '학습 자료 목록',
    schema: {
      example: successExample({
        materials: [
          { materialId: 1, type: 'GRAMMAR_TABLE', contentText: { title: '동사 + 아요/어요', rows: [] } },
        ],
      }),
    },
  })
  @Get(':sectionId/material')
  async materials(@Param('sectionId', ParseIntPipe) sectionId: number) {
    return this.logService.getSectionMaterialsList(sectionId);
  }

  @ApiOperation({ summary: '섹션 단어 카드 목록', description: '섹션의 단어 카드(앞면/뒷면/음원) 목록을 반환합니다.' })
  @ApiParam({ name: 'sectionId', description: '섹션 ID', example: 5 })
  @ApiResponse({
    status: 200,
    description: '단어 카드 목록',
    schema: {
      example: successExample({
        cards: [
          { cardId: 1, front: '사랑', back: 'Love', audioUrl: 'https://cdn.example.com/audio/1.mp3' },
        ],
      }),
    },
  })
  @Get(':sectionId/card')
  async cards(@Param('sectionId', ParseIntPipe) sectionId: number) {
    return this.logService.getSectionCardsList(sectionId);
  }

  @ApiOperation({ summary: '섹션 문제 목록', description: '섹션의 퀴즈/문제 목록을 반환합니다.' })
  @ApiParam({ name: 'sectionId', description: '섹션 ID', example: 5 })
  @ApiResponse({
    status: 200,
    description: '문제 목록',
    schema: {
      example: successExample({
        questions: [
          { questionId: 1, questionText: '다음 중 "안녕하세요"의 의미로 옳은 것은?', options: ['Hello', 'Goodbye', 'Thank you', 'Sorry'], answerIndex: 0 },
        ],
      }),
    },
  })
  @Get(':sectionId/question')
  async questions(@Param('sectionId', ParseIntPipe) sectionId: number) {
    return this.logService.getSectionQuestionsList(sectionId);
  }

  @ApiOperation({ summary: '섹션 학습 진행 저장', description: '현재 페이지, 머문 시간, 난이도를 저장하고 다음 섹션 정보를 반환합니다. (Idempotency-Key 헤더 권장)' })
  @ApiParam({ name: 'sectionId', description: '섹션 ID', example: 5 })
  @ApiHeader({ name: 'Idempotency-Key', description: '중복 요청 방지 키 (UUID 권장)', required: false })
  @ApiResponse({
    status: 200,
    description: '진행 저장 성공',
    schema: {
      example: successExample({
        sectionCompleted: true,
        nextSection: {
          courseId: 1,
          lessonId: 2,
          sectionId: 6,
          type: 'VOCAB',
          title: '단어 카드',
        },
        badgesEarned: [],
      }),
    },
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
