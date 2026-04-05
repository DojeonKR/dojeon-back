import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';

export class VerifyEmailCodeDto {
  @ApiProperty({ description: '이메일 주소', example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: '6자리 인증 코드', example: '123456' })
  @IsString()
  @Length(6, 6)
  code!: string;
}
