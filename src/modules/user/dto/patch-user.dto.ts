import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

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

  @ApiPropertyOptional({ description: '한국어 수준', example: 'BEGINNER', enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] })
  @IsOptional()
  @IsString()
  proficiencyLevel?: string;

  @ApiPropertyOptional({ description: '연령대', example: '20s' })
  @IsOptional()
  @IsString()
  ageGroup?: string;

  @ApiPropertyOptional({ description: '하루 목표 학습 시간(분, 1~1440)', example: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  dailyGoalMin?: number;

  @ApiPropertyOptional({ description: '학습 목표', example: '여행 회화' })
  @IsOptional()
  @IsString()
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
}
