import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { PracticeService } from './practice.service';

@Controller('practice')
export class PracticeController {
  constructor(private readonly practiceService: PracticeService) {}

  @Get('topic')
  async topics() {
    return this.practiceService.listTopics();
  }

  @Get('topic/:topicId/question')
  async questions(@Param('topicId', ParseIntPipe) topicId: number) {
    return this.practiceService.listQuestions(topicId);
  }
}
