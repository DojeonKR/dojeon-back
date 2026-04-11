import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LearningService } from './learning.service';
import { CurrentUser, JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { successExample, errorExample } from '../../common/swagger/swagger-response.helper';

@ApiTags('학습 (Learning)')
@ApiBearerAuth('access-token')
@Controller()
export class LearningController {
  constructor(private readonly learningService: LearningService) {}

  @ApiOperation({ summary: '코스 대시보드 조회', description: '진행 중인 코스 목록, 이어하기 배너, 전체 진도율을 반환합니다.' })
  @ApiResponse({
    status: 200,
    description:
      '코스별로 `description`·`orderNum`·`totalSections`·`completedSections`·`totalStaySeconds`·레슨별 `subtitle`·`sectionCount`·`completedSectionCount`·`progressPercent` 등이 포함됩니다. `resumeBanner`는 미완료 섹션이 없으면 `null`일 수 있습니다.',
    schema: {
      example: successExample({
        resumeBanner: {
          courseId: 1,
          courseTitle: '한국어 기초',
          lessonId: 2,
          lessonTitle: '기초 문법 1',
          sectionId: 5,
          sectionTitle: '동사 활용',
          sectionType: 'GRAMMAR',
          grammarPreview: '동사 + 아요/어요',
          overallProgressPercent: 60,
        },
        courses: [
          {
            courseId: 1,
            title: '한국어 기초',
            description: '입문',
            orderNum: 1,
            isActive: true,
            totalSections: 10,
            completedSections: 4,
            overallProgressPercent: 40,
            totalStaySeconds: 3600,
            lessons: [
              {
                lessonId: 1,
                title: '인사하기',
                subtitle: null,
                orderNum: 1,
                sectionCount: 3,
                completedSectionCount: 3,
                progressPercent: 100,
                isCompleted: true,
              },
              {
                lessonId: 2,
                title: '기초 문법 1',
                subtitle: null,
                orderNum: 2,
                sectionCount: 2,
                completedSectionCount: 1,
                progressPercent: 50,
                isCompleted: false,
              },
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
    description:
      '최상위 레슨 제목 필드명은 `title`(Swagger 예전 `lessonTitle` 아님). `siblingLessons`·섹션별 `totalPages`·`currentPage`·`progressPercent`·`hasContent`·`orderNum` 포함.',
    schema: {
      example: successExample({
        courseId: 1,
        lessonId: 2,
        title: '기초 문법 1',
        subtitle: null,
        siblingLessons: [
          { lessonId: 1, title: '인사하기', orderNum: 1 },
          { lessonId: 2, title: '기초 문법 1', orderNum: 2 },
        ],
        overallProgressPercent: 50,
        sections: [
          {
            sectionId: 5,
            type: 'GRAMMAR',
            title: '동사 활용',
            totalPages: 5,
            orderNum: 1,
            currentPage: 5,
            progressPercent: 100,
            isCompleted: true,
            hasContent: true,
          },
          {
            sectionId: 6,
            type: 'VOCAB',
            title: '단어 카드',
            totalPages: 3,
            orderNum: 2,
            currentPage: 1,
            progressPercent: 33,
            isCompleted: false,
            hasContent: true,
          },
        ],
      }),
    },
  })
  @ApiResponse({
    status: 404,
    description: '레슨 없음',
    schema: { example: errorExample('레슨을 찾을 수 없습니다.', 404, 'LESSON_NOT_FOUND') },
  })
  @Get('lessons/:lessonId/sections')
  async lessonSections(
    @CurrentUser() user: JwtPayloadUser,
    @Param('lessonId', ParseIntPipe) lessonId: number,
  ) {
    return this.learningService.getLessonSections(user.userId, lessonId);
  }
}
