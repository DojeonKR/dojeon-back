import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class SectionProgressDto {
  @ApiProperty({ description: '현재까지 본 페이지 번호 (0-based)', example: 3 })
  @IsInt()
  @Min(0)
  currentPage!: number;

  @ApiProperty({ description: '해당 섹션에서 머문 누적 시간(초)', example: 120 })
  @IsInt()
  @Min(0)
  stayTimeSeconds!: number;

  @ApiPropertyOptional({ description: '강제 완료 처리 여부', example: false })
  @IsOptional()
  @IsBoolean()
  forceComplete?: boolean;

  @ApiPropertyOptional({ description: '학습 난이도 자가 평가', enum: ['EASY', 'NORMAL', 'HARD'], example: 'NORMAL' })
  @IsOptional()
  @IsIn(['EASY', 'NORMAL', 'HARD'])
  difficulty?: 'EASY' | 'NORMAL' | 'HARD';
}
