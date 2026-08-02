import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: '리프레시 토큰', example: 'eyJhb...' })
  @IsString()
  @MinLength(10)
  @MaxLength(512)
  refreshToken!: string;
}
