import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ description: '이메일 주소', example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: '비밀번호', example: 'password123!' })
  @IsString()
  @MinLength(1)
  password!: string;
}
