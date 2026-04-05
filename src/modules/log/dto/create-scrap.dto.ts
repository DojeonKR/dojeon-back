import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, ValidateIf } from 'class-validator';
import { ScrapType } from '@prisma/client';

export class CreateScrapDto {
  @ApiProperty({ description: '스크랩 유형', enum: ScrapType, example: 'VOCAB' })
  @IsEnum(ScrapType)
  type!: ScrapType;

  @ApiPropertyOptional({ description: 'VOCAB 타입일 때 필수 — 단어 카드 ID', example: 1 })
  @ValidateIf((o: CreateScrapDto) => o.type === ScrapType.VOCAB)
  @IsInt()
  cardId?: number;

  @ApiPropertyOptional({ description: 'GRAMMAR 타입일 때 필수 — 학습 자료 ID', example: 1 })
  @ValidateIf((o: CreateScrapDto) => o.type === ScrapType.GRAMMAR)
  @IsInt()
  materialId?: number;

  @ApiPropertyOptional({ description: '스크랩한 섹션 ID (선택)', example: 10 })
  @IsOptional()
  @IsInt()
  sectionId?: number;
}
