import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { NlpService } from './nlp.service';
import { AnalyzeNlpDto } from './dto/analyze-nlp.dto';
import { CurrentUser, JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { successExample, errorExample } from '../../common/swagger/swagger-response.helper';

@ApiTags('NLP')
@ApiBearerAuth('access-token')
@Controller('nlp')
export class NlpController {
  constructor(private readonly nlpService: NlpService) {}

  @Post('analyze')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: '문장 분석 작업 요청', description: 'SQS에 작업을 넣고 jobId를 반환합니다.' })
  @ApiResponse({
    status: 202,
    description: '작업 접수',
    schema: { example: successExample({ jobId: '550e8400-e29b-41d4-a716-446655440000' }) },
  })
  @ApiResponse({
    status: 503,
    description: '큐 미설정',
    schema: { example: errorExample('NLP 큐가 설정되지 않았습니다.', 503, 'NLP_QUEUE_NOT_CONFIGURED') },
  })
  async analyze(@CurrentUser() user: JwtPayloadUser, @Body() dto: AnalyzeNlpDto) {
    return this.nlpService.analyze(user.userId, dto.text);
  }

  @Get('job/:jobId')
  @ApiOperation({ summary: 'NLP 작업 상태 조회' })
  @ApiResponse({
    status: 200,
    description: '작업 상태',
    schema: {
      example: successExample({
        jobId: '550e8400-e29b-41d4-a716-446655440000',
        status: 'done',
        result: { morphemes: [] },
      }),
    },
  })
  @ApiResponse({
    status: 404,
    description: '없는 작업 또는 타인 작업',
    schema: { example: errorExample('작업을 찾을 수 없습니다.', 404, 'NLP_JOB_NOT_FOUND') },
  })
  async getJob(@CurrentUser() user: JwtPayloadUser, @Param('jobId') jobId: string) {
    return this.nlpService.getJob(user.userId, jobId);
  }
}
