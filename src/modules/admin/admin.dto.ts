import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SectionType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  Allow,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateCourseDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  orderNum!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class PatchCourseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  orderNum?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateLessonDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subtitle?: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  orderNum!: number;
}

export class PatchLessonDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subtitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  orderNum?: number;
}

export class CreateSectionDto {
  @ApiProperty({ enum: SectionType })
  @IsEnum(SectionType)
  type!: SectionType;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  totalPages!: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  orderNum!: number;
}

export class PatchSectionDto {
  @ApiPropertyOptional({ enum: SectionType })
  @IsOptional()
  @IsEnum(SectionType)
  type?: SectionType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  totalPages?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  orderNum?: number;
}

export class CreateCardDto {
  @ApiProperty()
  @IsString()
  wordFront!: string;

  @ApiProperty()
  @IsString()
  wordBack!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  audioUrl?: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  sequence!: number;
}

export class PatchCardDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  wordFront?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  wordBack?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  audioUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sequence?: number;
}

export class BulkCardsItemDto {
  @ApiProperty()
  @IsString()
  wordFront!: string;

  @ApiProperty()
  @IsString()
  wordBack!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  audioUrl?: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  sequence!: number;
}

export class BulkCardsDto {
  @ApiProperty({ type: [BulkCardsItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkCardsItemDto)
  cards!: BulkCardsItemDto[];
}

export class CreateMaterialDto {
  @ApiProperty({ example: 'GRAMMAR_TABLE' })
  @IsString()
  type!: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  sequence!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isExtra?: boolean;

  @ApiProperty({ description: 'JSON 본문 (예: 문법 표, 리스닝 audioUrl 등)' })
  @IsObject()
  contentText!: Record<string, unknown>;
}

export class PatchMaterialDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sequence?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isExtra?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  contentText?: Record<string, unknown>;
}

export class CreateQuestionDto {
  @ApiProperty({ example: 'MCQ' })
  @IsString()
  type!: string;

  @ApiProperty()
  @IsString()
  questionText!: string;

  @ApiProperty({ description: '선택지 등 JSON' })
  @Allow()
  options!: unknown;

  @ApiProperty()
  @IsString()
  answer!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  explanation?: string;
}

export class PatchQuestionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  questionText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  options?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  answer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  explanation?: string;
}

export class AdminAudioPresignedDto {
  @ApiProperty({ example: 'mp3' })
  @IsString()
  fileExtension!: string;

  @ApiProperty({ example: 'audio/mpeg' })
  @IsString()
  contentType!: string;
}
