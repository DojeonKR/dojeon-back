import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HomeService } from './home.service';
import { CurrentUser, JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { successExample } from '../../common/swagger/swagger-response.helper';

@ApiTags('홈 (Home)')
@ApiBearerAuth('access-token')
@Controller('home')
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  @ApiOperation({ summary: '홈 화면 정보 조회', description: '사용자 이름, 연속 학습 일수, 오늘의 목표, 최근 학습 레슨 정보를 반환합니다.' })
  @ApiResponse({
    status: 200,
    description: '홈 정보 조회 성공',
    schema: {
      example: successExample({
        userFirstName: '도전',
        dailyStreak: 7,
        todayGoal: { targetMin: 30, studiedMin: 15 },
        lastLesson: {
          courseId: 1,
          lessonId: 2,
          sectionId: 5,
          lessonTitle: '기초 문법 1',
          sectionTitle: '동사 활용',
          sectionType: 'GRAMMAR',
          overallProgressPercent: 60,
          grammarPreview: '동사 + 아요/어요',
        },
      }),
    },
  })
  @Get('resume')
  async resume(@CurrentUser() user: JwtPayloadUser) {
    return this.homeService.getResume(user.userId);
  }
}
