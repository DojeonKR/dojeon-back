import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ description: '현재 비밀번호' })
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @ApiProperty({
    description: '새 비밀번호 (8자 이상, 대문자·소문자·숫자·특수문자 각 1개 이상)',
    example: 'Password1!',
  })
  @IsString()
  @MinLength(8)
  @Matches(/[A-Z]/, { message: '비밀번호에 대문자가 1자 이상 포함되어야 합니다.' })
  @Matches(/[a-z]/, { message: '비밀번호에 소문자가 1자 이상 포함되어야 합니다.' })
  @Matches(/[0-9]/, { message: '비밀번호에 숫자가 1자 이상 포함되어야 합니다.' })
  @Matches(/[^A-Za-z0-9]/, { message: '비밀번호에 특수문자가 1자 이상 포함되어야 합니다.' })
  newPassword!: string;
}
