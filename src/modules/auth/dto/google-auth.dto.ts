import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class GoogleAuthDto {
  @ApiProperty({ description: 'Google OAuth ID Token', example: 'eyJhb...' })
  @IsString()
  @MinLength(10)
  @MaxLength(4096)
  idToken!: string;
}
