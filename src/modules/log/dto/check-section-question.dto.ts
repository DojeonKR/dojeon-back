import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, MinLength } from 'class-validator';

export class CheckSectionQuestionDto {
  @ApiProperty({ description: '문제 ID', example: 1 })
  @IsInt()
  questionId!: number;

  @ApiProperty({ description: '사용자가 제출한 답 (선택지 텍스트 또는 빈칸 채우기 문자열)', example: '마시다' })
  @IsString()
  @MinLength(1)
  userAnswer!: string;
}
