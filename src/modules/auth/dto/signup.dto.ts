import { IsEmail, IsOptional, IsString, Length, MinLength } from 'class-validator';

export class SignupDto {
  @IsString()
  verifyToken!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @Length(1, 50)
  nickname!: string;

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
  dailyGoalMin?: number;
}
