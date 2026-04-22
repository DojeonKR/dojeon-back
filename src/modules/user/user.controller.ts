import { Body, Controller, Delete, Get, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserService } from './user.service';
import { CurrentUser, JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { PatchUserDto } from './dto/patch-user.dto';
import { PresignedProfileImageDto } from './dto/presigned-profile-image.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { successExample, errorExample } from '../../common/swagger/swagger-response.helper';

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
    description:
      '내 정보 조회 성공. 실제 본문은 `profile`·`stats`·`attendance`·`recentCourse`(nullable)·`recentAchievements` 구조입니다. `userFirstName` 필드는 없고 닉네임은 `profile.nickname`입니다.',
    schema: {
      example: successExample({
        profile: {
          userId: '1',
          email: 'user@example.com',
          nickname: '도전이',
          username: 'user_a1b2c',
          phoneNumber: null,
          birthday: null,
          profileImgUrl: null,
          motherLanguage: null,
          proficiencyLevel: null,
          ageGroup: null,
          dailyGoalMin: 30,
          learningGoal: null,
          subscriptionTier: 'FREE',
          subscriptionPlanId: null,
          subscriptionExpiresAt: null,
          isPushNotificationOn: true,
          isMarketingAgreed: false,
          createdAt: '2026-04-01T00:00:00.000Z',
        },
        stats: {
          totalStudyMin: 120,
          currentStreak: 3,
          bestStreak: 7,
          totalCompletedLessons: 2,
        },
        attendance: { year: 2026, month: 4, activeDays: [1, 3, 5, 7] },
        recentCourse: {
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
        recentAchievements: [{ badgeId: 1, title: '첫 발걸음', imageUrl: 'https://...', earnedAt: '2026-04-01T00:00:00.000Z' }],
      }),
    },
  })
  @ApiResponse({ status: 404, description: 'JWT와 불일치하는 사용자', schema: { example: errorExample('사용자를 찾을 수 없습니다.', 404, 'USER_NOT_FOUND') } })
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
  @ApiResponse({
    status: 409,
    description: '닉네임·username 중복',
    schema: { example: errorExample('이미 사용 중인 닉네임 또는 사용자명입니다.', 409, 'DUPLICATE_ENTRY') },
  })
  @ApiResponse({
    status: 400,
    description: '그 외 수정 실패',
    schema: { example: errorExample('프로필 수정에 실패했습니다.', 400, 'UPDATE_FAILED') },
  })
  @Patch('me')
  async patchMe(@CurrentUser() user: JwtPayloadUser, @Body() dto: PatchUserDto) {
    return this.userService.patchMe(user.userId, dto);
  }

  @ApiOperation({
    summary: '비밀번호 변경 (로그인 상태)',
    description: '현재 비밀번호 확인 후 새 비밀번호로 변경합니다. 소셜 전용 계정은 사용할 수 없습니다.',
  })
  @ApiResponse({
    status: 200,
    description: '변경 성공',
    schema: { example: successExample({ updated: true }) },
  })
  @ApiResponse({
    status: 400,
    description: '소셜 전용 계정',
    schema: { example: errorExample('소셜 로그인 계정은 비밀번호가 없습니다.', 400, 'PASSWORD_NOT_SET') },
  })
  @ApiResponse({
    status: 401,
    description: '현재 비밀번호 불일치',
    schema: { example: errorExample('현재 비밀번호가 올바르지 않습니다.', 401, 'INVALID_CURRENT_PASSWORD') },
  })
  @Patch('me/password')
  async changePassword(@CurrentUser() user: JwtPayloadUser, @Body() dto: ChangePasswordDto) {
    return this.userService.changePassword(user.userId, dto);
  }

  @ApiOperation({
    summary: '회원 탈퇴',
    description: '계정과 연관 데이터를 삭제합니다(Cascade). JWT 캐시 키를 정리합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '탈퇴 완료',
    schema: { example: successExample({ deleted: true }) },
  })
  @Delete('me')
  async deleteMe(@CurrentUser() user: JwtPayloadUser) {
    return this.userService.deleteAccount(user.userId);
  }

  @ApiOperation({ summary: '업적(뱃지) 목록 조회', description: '전체 뱃지 목록과 획득 여부, 획득 날짜를 반환합니다.' })
  @ApiResponse({
    status: 200,
    description: '업적 목록 조회 성공',
    schema: {
      example: successExample({
        totalEarned: 2,
        badges: [
          { badgeId: 1, title: '첫 발걸음', description: '첫 번째 섹션 완료', imageUrl: 'https://...', isEarned: true, earnedAt: '2026-04-01T00:00:00.000Z' },
          { badgeId: 2, title: '7일 연속', description: '7일 연속 학습', imageUrl: 'https://...', isEarned: false, earnedAt: null },
        ],
      }),
    },
  })
  @Get('me/achievement')
  async getAchievements(@CurrentUser() user: JwtPayloadUser) {
    return this.userService.getAchievementsList(user.userId);
  }

  @ApiOperation({
    summary: '프로필 이미지 업로드 URL 발급',
    description:
      'S3 presigned PUT URL·객체 key·fileUrl을 반환합니다. presigned 만료는 서버에서 3600초로 고정이며, 응답 JSON에 `expiresIn` 필드는 없습니다.',
  })
  @ApiResponse({
    status: 200,
    description: 'Presigned URL 발급 성공',
    schema: {
      example: successExample({
        uploadUrl: 'https://s3.amazonaws.com/bucket/key?X-Amz-Signature=...',
        key: 'profiles/1/uuid.jpg',
        fileUrl: 'https://bucket.s3.ap-northeast-2.amazonaws.com/profiles/1/uuid.jpg',
      }),
    },
  })
  @ApiResponse({
    status: 503,
    description: 'S3 버킷 미설정',
    schema: { example: errorExample('S3가 설정되지 않았습니다.', 503, 'S3_NOT_CONFIGURED') },
  })
  @Post('me/profileImage/presignedUrl')
  async presignedProfileImage(
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: PresignedProfileImageDto,
  ) {
    return this.userService.createProfileImagePresignedUrl(user.userId, dto);
  }
}
