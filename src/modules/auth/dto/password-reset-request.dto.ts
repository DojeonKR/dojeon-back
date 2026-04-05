import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class PasswordResetRequestDto {
  @ApiProperty({ description: '비밀번호를 재설정할 이메일 주소', example: 'user@example.com' })
  @IsEmail()
  email!: string;
}
