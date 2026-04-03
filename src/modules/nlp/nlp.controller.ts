import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { NlpService } from './nlp.service';
import { CurrentUser, JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { NlpAnalyzeDto } from './dto/nlp-analyze.dto';

@Controller('nlp')
export class NlpController {
  constructor(private readonly nlpService: NlpService) {}

  @Post('analyze')
  async analyze(@CurrentUser() user: JwtPayloadUser, @Body() dto: NlpAnalyzeDto) {
    return this.nlpService.analyze(user.userId, dto);
  }

  @Get('job/:jobId')
  async getJob(@CurrentUser() user: JwtPayloadUser, @Param('jobId') jobId: string) {
    return this.nlpService.getJob(user.userId, jobId);
  }
}
