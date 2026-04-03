import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { LearningService } from './learning.service';
import { CurrentUser, JwtPayloadUser } from '../../common/decorators/current-user.decorator';

@Controller()
export class LearningController {
  constructor(private readonly learningService: LearningService) {}

  @Get('courses/dashboard')
  async coursesDashboard(@CurrentUser() user: JwtPayloadUser) {
    return this.learningService.getCoursesDashboard(user.userId);
  }

  @Get('lessons/:lessonId/sections')
  async lessonSections(
    @CurrentUser() user: JwtPayloadUser,
    @Param('lessonId', ParseIntPipe) lessonId: number,
  ) {
    return this.learningService.getLessonSections(user.userId, lessonId);
  }
}
