import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class SignupDto {
  @ApiProperty({ description: '이메일 인증 후 발급된 verifyToken', example: 'a3f9c...' })
  @IsString()
  verifyToken!: string;

  @ApiProperty({ description: '이메일 주소', example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: '비밀번호 (8자 이상, 대문자·소문자·숫자·특수문자 각 1개 이상)',
    example: 'Password1!',
  })
  @IsString()
  @MinLength(8)
  @Matches(/[A-Z]/, { message: '비밀번호에 대문자가 1자 이상 포함되어야 합니다.' })
  @Matches(/[a-z]/, { message: '비밀번호에 소문자가 1자 이상 포함되어야 합니다.' })
  @Matches(/[0-9]/, { message: '비밀번호에 숫자가 1자 이상 포함되어야 합니다.' })
  @Matches(/[^A-Za-z0-9]/, { message: '비밀번호에 특수문자가 1자 이상 포함되어야 합니다.' })
  password!: string;

  @ApiProperty({ description: '이용약관 동의 (필수)', example: true })
  @IsBoolean()
  isTermsAgreed!: boolean;

  @ApiProperty({ description: '개인정보 처리방침 동의 (필수)', example: true })
  @IsBoolean()
  isPrivacyAgreed!: boolean;

  @ApiProperty({ description: '만 14세 이상 확인 (필수)', example: true })
  @IsBoolean()
  isAgeVerified!: boolean;

  @ApiPropertyOptional({ description: '마케팅 수신 동의 (선택)', example: false })
  @IsOptional()
  @IsBoolean()
  isMarketingAgreed?: boolean;
}
