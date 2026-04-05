import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: '리프레시 토큰', example: 'eyJhb...' })
  @IsString()
  @MinLength(10)
  refreshToken!: string;
}
