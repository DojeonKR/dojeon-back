import { IsEnum, IsInt, IsOptional, ValidateIf } from 'class-validator';
import { ScrapType } from '@prisma/client';

export class CreateScrapDto {
  @IsEnum(ScrapType)
  type!: ScrapType;

  @ValidateIf((o: CreateScrapDto) => o.type === ScrapType.VOCAB)
  @IsInt()
  cardId?: number;

  @ValidateIf((o: CreateScrapDto) => o.type === ScrapType.GRAMMAR)
  @IsInt()
  materialId?: number;

  @IsOptional()
  @IsInt()
  sectionId?: number;
}
