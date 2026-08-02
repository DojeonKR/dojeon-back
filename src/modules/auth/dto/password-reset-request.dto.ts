import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, MaxLength } from 'class-validator';

export class PasswordResetRequestDto {
  @ApiProperty({ description: '비밀번호를 재설정할 이메일 주소', example: 'user@example.com' })
  @IsEmail()
  @MaxLength(254)
  email!: string;
}
