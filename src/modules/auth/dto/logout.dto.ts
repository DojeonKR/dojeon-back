import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class LogoutDto {
  @ApiProperty({ description: '로그아웃 처리할 리프레시 토큰', example: 'eyJhb...' })
  @IsString()
  @MinLength(10)
  refreshToken!: string;
}
