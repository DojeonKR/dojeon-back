import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import { normalizeQuizAnswer } from '../../common/utils/quiz-answer.util';
import { CheckPracticeQuestionDto } from './dto/check-practice-question.dto';

@Injectable()
export class PracticeService {
  constructor(private readonly prisma: PrismaService) {}

  async listTopics() {
    const topics = await this.prisma.practiceTopic.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
    });
    return { topics };
  }

  async listQuestions(topicId: number) {
    const topic = await this.prisma.practiceTopic.findUnique({ where: { id: topicId } });
    if (!topic) {
      throw new AppException('TOPIC_NOT_FOUND', '토픽을 찾을 수 없습니다.', HttpStatus.NOT_FOUND);
    }
    const questions = await this.prisma.practiceQuestion.findMany({
      where: { topicId },
      orderBy: { id: 'asc' },
    });
    return {
      topicId,
      questions: questions.map((q) => ({
        id: q.id,
        type: q.type,
        questionText: q.questionText,
        options: q.options,
        explanation: q.explanation,
      })),
    };
  }

  /** 정책 A: 정답일 때만 correctAnswer·explanation 포함 */
  async checkPracticeQuestion(
    userId: bigint,
    topicId: number,
    dto: CheckPracticeQuestionDto,
  ): Promise<
    | { correct: false }
    | { correct: true; correctAnswer: string; explanation: string | null }
  > {
    void userId;
    const topic = await this.prisma.practiceTopic.findUnique({ where: { id: topicId } });
    if (!topic) {
      throw new AppException('TOPIC_NOT_FOUND', '토픽을 찾을 수 없습니다.', HttpStatus.NOT_FOUND);
    }
    const q = await this.prisma.practiceQuestion.findFirst({
      where: { id: dto.questionId, topicId },
    });
    if (!q) {
      throw new AppException('QUESTION_NOT_FOUND', '문제를 찾을 수 없습니다.', HttpStatus.NOT_FOUND);
    }
    const correct =
      normalizeQuizAnswer(dto.userAnswer) === normalizeQuizAnswer(q.answer);
    if (!correct) {
      return { correct: false };
    }
    return {
      correct: true,
      correctAnswer: q.answer,
      explanation: q.explanation ?? null,
    };
  }
}
