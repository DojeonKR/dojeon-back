import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, MinLength } from 'class-validator';

export class CheckPracticeQuestionDto {
  @ApiProperty({ description: '문제 ID', example: 1 })
  @IsInt()
  questionId!: number;

  @ApiProperty({ description: '사용자가 제출한 답', example: 'Hello' })
  @IsString()
  @MinLength(1)
  userAnswer!: string;
}
