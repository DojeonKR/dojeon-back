import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class GoogleAuthDto {
  @ApiProperty({ description: 'Google OAuth ID Token', example: 'eyJhb...' })
  @IsString()
  @MinLength(10)
  idToken!: string;
}
