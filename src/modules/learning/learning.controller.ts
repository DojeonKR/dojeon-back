import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LearningService } from './learning.service';
import { CurrentUser, JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { successExample } from '../../common/swagger/swagger-response.helper';

@ApiTags('학습 (Learning)')
@ApiBearerAuth('access-token')
@Controller()
export class LearningController {
  constructor(private readonly learningService: LearningService) {}

  @ApiOperation({ summary: '코스 대시보드 조회', description: '진행 중인 코스 목록, 이어하기 배너, 전체 진도율을 반환합니다.' })
  @ApiResponse({
    status: 200,
    description: '코스 대시보드 조회 성공',
    schema: {
      example: successExample({
        resumeBanner: {
          courseId: 1,
          lessonId: 2,
          sectionId: 5,
          lessonTitle: '기초 문법 1',
          sectionTitle: '동사 활용',
        },
        courses: [
          {
            courseId: 1,
            title: '한국어 기초',
            overallProgressPercent: 45,
            isActive: true,
            lessons: [
              { lessonId: 1, title: '인사하기', isCompleted: true },
              { lessonId: 2, title: '기초 문법 1', isCompleted: false },
            ],
          },
        ],
      }),
    },
  })
  @Get('courses/dashboard')
  async coursesDashboard(@CurrentUser() user: JwtPayloadUser) {
    return this.learningService.getCoursesDashboard(user.userId);
  }

  @ApiOperation({ summary: '레슨 섹션 목록 조회', description: '레슨 내 섹션 목록과 각 섹션의 진행 상태를 반환합니다.' })
  @ApiParam({ name: 'lessonId', description: '레슨 ID', example: 2 })
  @ApiResponse({
    status: 200,
    description: '섹션 목록 조회 성공',
    schema: {
      example: successExample({
        lessonId: 2,
        lessonTitle: '기초 문법 1',
        isCompleted: false,
        overallProgressPercent: 33,
        sections: [
          { sectionId: 5, title: '동사 활용', type: 'GRAMMAR', isCompleted: true },
          { sectionId: 6, title: '단어 카드', type: 'VOCAB', isCompleted: false },
        ],
      }),
    },
  })
  @Get('lessons/:lessonId/sections')
  async lessonSections(
    @CurrentUser() user: JwtPayloadUser,
    @Param('lessonId', ParseIntPipe) lessonId: number,
  ) {
    return this.learningService.getLessonSections(user.userId, lessonId);
  }
}
