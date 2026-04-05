import { Body, Controller, Get, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserService } from './user.service';
import { CurrentUser, JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { PatchUserDto } from './dto/patch-user.dto';
import { PresignedProfileImageDto } from './dto/presigned-profile-image.dto';
import { successExample } from '../../common/swagger/swagger-response.helper';

@ApiTags('사용자 (User)')
@ApiBearerAuth('access-token')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @ApiOperation({ summary: '내 정보 조회', description: '사용자 프로필, 출석 달력, 통계, 최근 학습 코스를 반환합니다. year/month 미지정 시 현재 연월 기준.' })
  @ApiQuery({ name: 'year', description: '조회 연도 (기본: 현재 연도)', required: false, example: 2026 })
  @ApiQuery({ name: 'month', description: '조회 월 (기본: 현재 월)', required: false, example: 4 })
  @ApiResponse({
    status: 200,
    description: '내 정보 조회 성공',
    schema: {
      example: successExample({
        userId: '1',
        nickname: '도전이',
        profileImgUrl: null,
        subscriptionTier: 'FREE',
        attendance: {
          year: 2026,
          month: 4,
          activeDays: [1, 3, 5, 7],
        },
        stats: {
          currentStreak: 3,
          bestStreak: 7,
          totalStudyDays: 15,
        },
        recentCourse: {
          courseId: 1,
          lessonId: 2,
          sectionId: 5,
          lessonTitle: '기초 문법 1',
          sectionTitle: '동사 활용',
        },
        todayGoal: { targetMin: 30, studiedMin: 15 },
      }),
    },
  })
  @Get('me')
  async getMe(
    @CurrentUser() user: JwtPayloadUser,
    @Query('year') yearStr?: string,
    @Query('month') monthStr?: string,
  ) {
    const year = yearStr ? parseInt(yearStr, 10) : undefined;
    const month = monthStr ? parseInt(monthStr, 10) : undefined;
    return this.userService.getDashboard(user.userId, year, month);
  }

  @ApiOperation({ summary: '내 정보 수정 / 온보딩 정보 저장', description: '닉네임(온보딩 1단계), 모국어·수준·연령대·목표(온보딩 이후) 등을 수정합니다. 온보딩 단계에서도 이 API를 사용합니다.' })
  @ApiResponse({
    status: 200,
    description: '정보 수정 성공',
    schema: { example: successExample({ updated: true }) },
  })
  @Patch('me')
  async patchMe(@CurrentUser() user: JwtPayloadUser, @Body() dto: PatchUserDto) {
    return this.userService.patchMe(user.userId, dto);
  }

  @ApiOperation({ summary: '업적(뱃지) 목록 조회', description: '전체 뱃지 목록과 획득 여부, 획득 날짜를 반환합니다.' })
  @ApiResponse({
    status: 200,
    description: '업적 목록 조회 성공',
    schema: {
      example: successExample({
        totalEarned: 2,
        badges: [
          { badgeId: 1, name: '첫 발걸음', description: '첫 번째 섹션 완료', iconUrl: null, isEarned: true, earnedAt: '2026-04-01T00:00:00.000Z' },
          { badgeId: 2, name: '7일 연속', description: '7일 연속 학습', iconUrl: null, isEarned: false, earnedAt: null },
        ],
      }),
    },
  })
  @Get('me/achievement')
  async getAchievements(@CurrentUser() user: JwtPayloadUser) {
    return this.userService.getAchievementsList(user.userId);
  }

  @ApiOperation({ summary: '프로필 이미지 업로드 URL 발급', description: 'S3 presigned URL과 업로드 후 접근할 fileUrl을 반환합니다.' })
  @ApiResponse({
    status: 200,
    description: 'Presigned URL 발급 성공',
    schema: {
      example: successExample({
        uploadUrl: 'https://s3.amazonaws.com/bucket/key?X-Amz-Signature=...',
        fileUrl: 'https://cdn.example.com/profiles/1/photo.jpg',
        expiresIn: 300,
      }),
    },
  })
  @Post('me/profileImage/presignedUrl')
  async presignedProfileImage(
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: PresignedProfileImageDto,
  ) {
    return this.userService.createProfileImagePresignedUrl(user.userId, dto);
  }
}
