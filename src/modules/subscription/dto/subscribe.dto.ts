import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class SubscribeDto {
  @ApiProperty({ description: '구독할 플랜 ID', example: 'pro' })
  @IsString()
  @MinLength(1)
  planId!: string;
}
