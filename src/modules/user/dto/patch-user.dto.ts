import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Length } from 'class-validator';

export const PROFICIENCY_ONBOARDING = ['Nothing', 'Only hangul', 'Intermediate', 'Advanced'] as const;

export const AGE_GROUP_ONBOARDING = [
  '0-17',
  '18-24',
  '25-34',
  '35-44',
  '45-54',
  '55-64',
  '65-',
] as const;

export const DAILY_GOAL_MIN_ONBOARDING = [5, 15, 30, 60] as const;

export const LEARNING_GOAL_ONBOARDING = [
  'Fun',
  'Tourism',
  'Understanding Korean content',
  'Study in Korea',
  'Work in Korea',
  'Others',
] as const;

export class PatchUserDto {
  @ApiPropertyOptional({ description: '닉네임 (1~50자)', example: '도전이' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  nickname?: string;

  @ApiPropertyOptional({ description: '사용자명 (3~50자)', example: 'user_a8x9' })
  @IsOptional()
  @IsString()
  @Length(3, 50)
  username?: string;

  @ApiPropertyOptional({ description: '전화번호', example: '010-1234-5678' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({ description: '생년월일 (YYYY-MM-DD)', example: '1995-03-15' })
  @IsOptional()
  birthday?: string;

  @ApiPropertyOptional({ description: '모국어', example: 'English' })
  @IsOptional()
  @IsString()
  motherLanguage?: string;

  @ApiPropertyOptional({
    description: '한국어 수준 (온보딩 UI 선택지와 동일한 문자열)',
    example: 'Intermediate',
    enum: [...PROFICIENCY_ONBOARDING],
  })
  @IsOptional()
  @IsIn(PROFICIENCY_ONBOARDING)
  proficiencyLevel?: string;

  @ApiPropertyOptional({
    description: '연령대 (온보딩 UI 선택지와 동일한 문자열)',
    example: '18-24',
    enum: [...AGE_GROUP_ONBOARDING],
  })
  @IsOptional()
  @IsIn(AGE_GROUP_ONBOARDING)
  ageGroup?: string;

  @ApiPropertyOptional({
    description: '하루 목표 학습 시간(분, 온보딩에서 5·15·30·60 중 택일)',
    example: 30,
    enum: DAILY_GOAL_MIN_ONBOARDING,
  })
  @IsOptional()
  @IsInt()
  @IsIn(DAILY_GOAL_MIN_ONBOARDING)
  dailyGoalMin?: number;

  @ApiPropertyOptional({
    description: '학습 목표 (온보딩 UI 선택지와 동일한 문자열)',
    example: 'Tourism',
    enum: [...LEARNING_GOAL_ONBOARDING],
  })
  @IsOptional()
  @IsIn(LEARNING_GOAL_ONBOARDING)
  learningGoal?: string;

  @ApiPropertyOptional({ description: '푸시 알림 수신 여부', example: true })
  @IsOptional()
  @IsBoolean()
  isPushNotificationOn?: boolean;

  @ApiPropertyOptional({ description: '마케팅 수신 동의 여부', example: false })
  @IsOptional()
  @IsBoolean()
  isMarketingAgreed?: boolean;

  @ApiPropertyOptional({ description: 'FCM 디바이스 토큰', example: 'fcm-token-abc...' })
  @IsOptional()
  @IsString()
  deviceToken?: string;

  @ApiPropertyOptional({ description: '프로필 이미지 URL (S3 presigned 업로드 완료 후 저장)', example: 'https://bucket.s3.region.amazonaws.com/profiles/1/photo.jpg' })
  @IsOptional()
  @IsString()
  profileImgUrl?: string;

  @ApiPropertyOptional({ description: '온보딩 완료 여부. 온보딩 마지막 단계 완료 시 true로 전송.', example: true })
  @IsOptional()
  @IsBoolean()
  isOnboarded?: boolean;
}
