import { ApiProperty } from '@nestjs/swagger';
import { SectionType } from '@prisma/client';
import { ArrayUnique, IsArray, IsIn } from 'class-validator';

export const SELECTABLE_LESSON_SECTION_TYPES = [
  SectionType.VOCAB,
  SectionType.GRAMMAR,
  SectionType.READING,
  SectionType.LISTENING,
] as const;

export class UpdateLessonPreferencesDto {
  @ApiProperty({
    description: '다음 접속 때 복원할 레슨 학습 유형',
    enum: SELECTABLE_LESSON_SECTION_TYPES,
    isArray: true,
    example: ['VOCAB', 'GRAMMAR', 'READING', 'LISTENING'],
  })
  @IsArray()
  @ArrayUnique()
  @IsIn(SELECTABLE_LESSON_SECTION_TYPES, { each: true })
  selectedTypes!: SectionType[];
}
