import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PracticeService } from './practice.service';
import { successExample } from '../../common/swagger/swagger-response.helper';

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
        topics: [
          { topicId: 1, title: '기초 회화', description: '일상적인 인사와 자기소개', questionCount: 10 },
        ],
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
        title: '기초 회화',
        questions: [
          { questionId: 1, questionText: '다음 중 "안녕하세요"의 올바른 의미는?', options: ['Hello', 'Goodbye', 'Thank you', 'Sorry'], answerIndex: 0 },
        ],
      }),
    },
  })
  @Get('topic/:topicId/question')
  async questions(@Param('topicId', ParseIntPipe) topicId: number) {
    return this.practiceService.listQuestions(topicId);
  }
}
