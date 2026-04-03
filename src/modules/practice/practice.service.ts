import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import { HttpStatus } from '@nestjs/common';

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
    return { topicId, questions };
  }
}
