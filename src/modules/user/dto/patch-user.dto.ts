import { IsBoolean, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class PatchUserDto {
  @IsOptional()
  @IsString()
  @Length(1, 50)
  nickname?: string;

  @IsOptional()
  @IsString()
  @Length(3, 50)
  username?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  birthday?: string;

  @IsOptional()
  @IsString()
  motherLanguage?: string;

  @IsOptional()
  @IsString()
  proficiencyLevel?: string;

  @IsOptional()
  @IsString()
  ageGroup?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  dailyGoalMin?: number;

  @IsOptional()
  @IsString()
  learningGoal?: string;

  @IsOptional()
  @IsBoolean()
  isPushNotificationOn?: boolean;

  @IsOptional()
  @IsBoolean()
  isMarketingAgreed?: boolean;

  @IsOptional()
  @IsString()
  deviceToken?: string;
}
