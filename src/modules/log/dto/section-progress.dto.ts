import { IsBoolean, IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class SectionProgressDto {
  @IsInt()
  @Min(0)
  currentPage!: number;

  @IsInt()
  @Min(0)
  stayTimeSeconds!: number;

  @IsOptional()
  @IsBoolean()
  forceComplete?: boolean;

  @IsOptional()
  @IsIn(['EASY', 'NORMAL', 'HARD'])
  difficulty?: 'EASY' | 'NORMAL' | 'HARD';
}
