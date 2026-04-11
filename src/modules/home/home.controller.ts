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

  @ApiOperation({
    summary: '홈 화면 정보 조회',
    description:
      '`userFirstName`에는 **닉네임 전체**가 들어갑니다(이름 파싱 없음). `lastLesson`은 학습 이력이 없으면 `null`입니다. 이론상 사용자 레코드가 없으면 `data`가 `null`일 수 있습니다.',
  })
  @ApiResponse({
    status: 200,
    description: '홈 정보 조회 성공',
    schema: {
      example: successExample({
        userFirstName: '도전이',
        dailyStreak: 7,
        todayGoal: { targetMin: 30, studiedMin: 15 },
        weekGoal: { targetMin: 210, studiedMin: 45 },
        weeklyAttendance: [true, true, false, false, false, false, false],
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
