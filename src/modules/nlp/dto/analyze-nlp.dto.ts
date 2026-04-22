import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';

export class AnalyzeNlpDto {
  @ApiProperty({ description: '형태소 분석할 문장', example: '안녕하세요 반갑습니다.' })
  @IsString()
  @MinLength(1)
  @MaxLength(50_000)
  text!: string;
}
