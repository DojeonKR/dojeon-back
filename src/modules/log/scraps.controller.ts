import { Body, Controller, Delete, Get, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ScrapType } from '@prisma/client';
import { LogService } from './log.service';
import { CurrentUser, JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { CreateScrapDto } from './dto/create-scrap.dto';
import { AppException } from '../../common/exceptions/app.exception';
import { successExample, errorExample } from '../../common/swagger/swagger-response.helper';

@ApiTags('스크랩 (Scrap)')
@ApiBearerAuth('access-token')
@Controller('scrap')
export class ScrapsController {
  constructor(private readonly logService: LogService) {}

  @ApiOperation({ summary: '스크랩 대시보드', description: '단어장 그룹 미리보기와 문법 스크랩 미리보기를 반환합니다.' })
  @ApiResponse({
    status: 200,
    description: '스크랩 대시보드 조회 성공',
    schema: {
      example: successExample({
        userName: '도전',
        vocabularyPreview: {
          groups: [
            {
              courseTitle: '한국어 기초',
              items: [{ cardId: 1, front: '사랑', back: 'Love', audioUrl: null }],
            },
          ],
        },
        grammarPreview: [
          { materialId: 1, grammarPoint: '동사 + 아요/어요', courseTitle: '한국어 기초' },
        ],
      }),
    },
  })
  @Get('dashboard')
  async dashboard(@CurrentUser() user: JwtPayloadUser) {
    return this.logService.getScrapsDashboard(user.userId);
  }

  @ApiOperation({ summary: '스크랩 목록 조회', description: '타입별(VOCAB/GRAMMAR) 스크랩 목록을 커서 기반 페이지네이션으로 반환합니다.' })
  @ApiQuery({ name: 'type', description: '스크랩 유형', enum: ['VOCAB', 'GRAMMAR'], required: true })
  @ApiQuery({ name: 'sort', description: '정렬 기준 (기본: recent)', enum: ['recent'], required: false })
  @ApiQuery({ name: 'cursor', description: '이전 페이지의 마지막 scrapId (커서 페이지네이션)', required: false })
  @ApiQuery({ name: 'limit', description: '페이지당 개수 (기본: 20, 최대: 100)', required: false })
  @ApiResponse({
    status: 200,
    description: '스크랩 목록',
    schema: {
      example: successExample({
        items: [
          {
            scrapId: '10',
            targetType: 'VOCAB',
            content: { cardId: 1, front: '사랑', back: 'Love', audioUrl: null },
            createdAt: '2026-04-05T00:00:00.000Z',
          },
        ],
        nextCursor: '9',
        hasMore: true,
      }),
    },
  })
  @ApiResponse({ status: 400, description: 'type 쿼리 누락 또는 잘못된 값', schema: { example: errorExample('type은 VOCAB 또는 GRAMMAR 여야 합니다.', 400, 'INVALID_QUERY') } })
  @Get()
  async list(
    @CurrentUser() user: JwtPayloadUser,
    @Query('type') type: string,
    @Query('sort') sort?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limitStr?: string,
  ) {
    if (!type || (type !== 'VOCAB' && type !== 'GRAMMAR')) {
      throw new AppException('INVALID_QUERY', 'type은 VOCAB 또는 GRAMMAR 여야 합니다.', HttpStatus.BAD_REQUEST);
    }
    const limit = limitStr ? Math.min(Math.max(parseInt(limitStr, 10) || 20, 1), 100) : 20;
    return this.logService.listScraps(user.userId, type as ScrapType, sort ?? 'recent', cursor, limit);
  }

  @ApiOperation({ summary: '스크랩 추가', description: 'VOCAB 타입은 cardId 필수, GRAMMAR 타입은 materialId 필수입니다.' })
  @ApiResponse({
    status: 200,
    description: '스크랩 추가 성공',
    schema: { example: successExample({ scrapId: '11' }) },
  })
  @ApiResponse({ status: 400, description: 'cardId/materialId 누락', schema: { example: errorExample('cardId는 VOCAB 타입에서 필수입니다.', 400, 'VALIDATION_ERROR') } })
  @Post()
  async create(@CurrentUser() user: JwtPayloadUser, @Body() dto: CreateScrapDto) {
    return this.logService.createScrap(user.userId, dto);
  }

  @ApiOperation({ summary: '스크랩 삭제', description: '본인이 추가한 스크랩을 삭제합니다.' })
  @ApiParam({ name: 'scrapId', description: '삭제할 스크랩 ID', example: '11' })
  @ApiResponse({
    status: 200,
    description: '스크랩 삭제 성공',
    schema: { example: successExample({ deleted: true }) },
  })
  @ApiResponse({ status: 404, description: '스크랩을 찾을 수 없음', schema: { example: errorExample('스크랩을 찾을 수 없습니다.', 404, 'NOT_FOUND') } })
  @Delete(':scrapId')
  async remove(@CurrentUser() user: JwtPayloadUser, @Param('scrapId') scrapId: string) {
    return this.logService.deleteScrap(user.userId, BigInt(scrapId));
  }
}
