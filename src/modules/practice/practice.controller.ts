import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PracticeService } from './practice.service';
import { successExample, errorExample } from '../../common/swagger/swagger-response.helper';
import { CurrentUser, JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { CheckPracticeQuestionDto } from './dto/check-practice-question.dto';

@ApiTags('연습 (Practice)')
@ApiBearerAuth('access-token')
@Controller('practice')
export class PracticeController {
  constructor(private readonly practiceService: PracticeService) {}

  @ApiOperation({ summary: '연습 토픽 목록', description: '활성화된 연습 토픽 목록을 반환합니다.' })
  @ApiResponse({
    status: 200,
    description: '토픽 목록 조회 성공',
    schema: {
      example: successExample({
        topics: [{ id: 1, titleEn: 'Basic conversation', isActive: true }],
      }),
    },
  })
  @Get('topic')
  async topics() {
    return this.practiceService.listTopics();
  }

  @ApiOperation({ summary: '토픽 문제 목록', description: '특정 토픽의 연습 문제 목록을 반환합니다.' })
  @ApiParam({ name: 'topicId', description: '토픽 ID', example: 1 })
  @ApiResponse({
    status: 200,
    description: '문제 목록 조회 성공',
    schema: {
      example: successExample({
        topicId: 1,
        questions: [
          { id: 1, type: 'MCQ', questionText: '다음 중 "안녕하세요"의 올바른 의미는?', options: ['Hello', 'Goodbye', 'Thank you', 'Sorry'], explanation: null },
        ],
      }),
    },
  })
  @ApiResponse({
    status: 404,
    description: '토픽 없음',
    schema: { example: errorExample('토픽을 찾을 수 없습니다.', 404, 'TOPIC_NOT_FOUND') },
  })
  @Get('topic/:topicId/question')
  async questions(@Param('topicId', ParseIntPipe) topicId: number) {
    return this.practiceService.listQuestions(topicId);
  }

  @Throttle({ default: { limit: 45, ttl: 60000 } })
  @ApiOperation({
    summary: '연습 문제 채점',
    description: '정답일 때만 correctAnswer·explanation이 포함됩니다. 목록 API에는 정답이 없습니다.',
  })
  @ApiParam({ name: 'topicId', description: '토픽 ID' })
  @ApiResponse({
    status: 200,
    description: '채점 결과 — 오답 시 `{ correct: false }`만',
    schema: {
      example: successExample({ correct: true, correctAnswer: 'Hello', explanation: null }),
    },
  })
  @ApiResponse({
    status: 404,
    description: '토픽 또는 토픽에 속하지 않는 questionId',
    schema: { example: errorExample('문제를 찾을 수 없습니다.', 404, 'QUESTION_NOT_FOUND') },
  })
  @Post('topic/:topicId/questions/check')
  async checkQuestion(
    @CurrentUser() user: JwtPayloadUser,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Body() dto: CheckPracticeQuestionDto,
  ) {
    return this.practiceService.checkPracticeQuestion(user.userId, topicId, dto);
  }
}
