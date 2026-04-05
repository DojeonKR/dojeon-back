import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class SendEmailCodeDto {
  @ApiProperty({ description: '이메일 주소', example: 'user@example.com' })
  @IsEmail()
  email!: string;
}
