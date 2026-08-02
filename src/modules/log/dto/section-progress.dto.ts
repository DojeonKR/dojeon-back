import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class SectionProgressDto {
  @ApiProperty({ description: '현재까지 본 페이지 번호 (0-based)', example: 3 })
  @IsInt()
  @Min(0)
  @Max(10000)
  currentPage!: number;

  @ApiPropertyOptional({
    description:
      '이번 체류 시간이 발생한 페이지 번호 (0-based). 전달하면 페이지별 시간이 누적됩니다.',
    example: 2,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  pageNumber?: number;

  @ApiProperty({
    description: '마지막 저장 이후 추가로 머문 시간(초). 서버에서 섹션·페이지 누적값에 더합니다.',
    example: 30,
  })
  @IsInt()
  @Min(0)
  @Max(3600)
  stayTimeSeconds!: number;

  @ApiPropertyOptional({ description: '강제 완료 처리 여부', example: false })
  @IsOptional()
  @IsBoolean()
  forceComplete?: boolean;

  @ApiPropertyOptional({
    description:
      '완료 처리 여부. 응답의 `log.isCompleted`와 이름을 맞춘 `forceComplete` 별칭입니다.',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;

  @ApiPropertyOptional({
    description: '학습 난이도 자가 평가',
    enum: ['EASY', 'NORMAL', 'HARD'],
    example: 'NORMAL',
  })
  @IsOptional()
  @IsIn(['EASY', 'NORMAL', 'HARD'])
  difficulty?: 'EASY' | 'NORMAL' | 'HARD';
}
