import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import {
  AdminAudioPresignedDto,
  BulkCardsDto,
  CreateCardDto,
  CreateCourseDto,
  CreateLessonDto,
  CreateMaterialDto,
  CreateQuestionDto,
  CreateSectionDto,
  PatchCardDto,
  PatchCourseDto,
  PatchLessonDto,
  PatchMaterialDto,
  PatchQuestionDto,
  PatchSectionDto,
} from './admin.dto';
import { buildS3ObjectPublicUrl } from '../../common/utils/public-asset-url.util';

@Injectable()
export class AdminService {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const region = this.configService.get<string>('aws.region');
    this.bucket = this.configService.get<string>('aws.s3Bucket') ?? '';
    this.s3 = new S3Client({
      region,
      credentials:
        this.configService.get('aws.accessKeyId') && this.configService.get('aws.secretAccessKey')
          ? {
              accessKeyId: this.configService.get('aws.accessKeyId')!,
              secretAccessKey: this.configService.get('aws.secretAccessKey')!,
            }
          : undefined,
    });
  }

  async createCourse(dto: CreateCourseDto) {
    return this.prisma.course.create({
      data: {
        title: dto.title,
        description: dto.description ?? null,
        orderNum: dto.orderNum,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async patchCourse(courseId: number, dto: PatchCourseDto) {
    await this.ensureCourse(courseId);
    return this.prisma.course.update({
      where: { id: courseId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.orderNum !== undefined && { orderNum: dto.orderNum }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async deleteCourse(courseId: number) {
    await this.ensureCourse(courseId);
    await this.prisma.course.delete({ where: { id: courseId } });
    return { deleted: true };
  }

  async createLesson(courseId: number, dto: CreateLessonDto) {
    await this.ensureCourse(courseId);
    return this.prisma.lesson.create({
      data: {
        courseId,
        title: dto.title,
        subtitle: dto.subtitle ?? null,
        orderNum: dto.orderNum,
      },
    });
  }

  async patchLesson(lessonId: number, dto: PatchLessonDto) {
    await this.ensureLesson(lessonId);
    return this.prisma.lesson.update({
      where: { id: lessonId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.subtitle !== undefined && { subtitle: dto.subtitle }),
        ...(dto.orderNum !== undefined && { orderNum: dto.orderNum }),
      },
    });
  }

  async deleteLesson(lessonId: number) {
    await this.ensureLesson(lessonId);
    await this.prisma.lesson.delete({ where: { id: lessonId } });
    return { deleted: true };
  }

  async createSection(lessonId: number, dto: CreateSectionDto) {
    await this.ensureLesson(lessonId);
    return this.prisma.section.create({
      data: {
        lessonId,
        type: dto.type,
        title: dto.title,
        totalPages: dto.totalPages,
        orderNum: dto.orderNum,
      },
    });
  }

  async patchSection(sectionId: number, dto: PatchSectionDto) {
    await this.ensureSection(sectionId);
    return this.prisma.section.update({
      where: { id: sectionId },
      data: {
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.totalPages !== undefined && { totalPages: dto.totalPages }),
        ...(dto.orderNum !== undefined && { orderNum: dto.orderNum }),
      },
    });
  }

  async deleteSection(sectionId: number) {
    await this.ensureSection(sectionId);
    await this.prisma.section.delete({ where: { id: sectionId } });
    return { deleted: true };
  }

  async createCard(sectionId: number, dto: CreateCardDto) {
    await this.ensureSection(sectionId);
    return this.prisma.sectionCard.create({
      data: {
        sectionId,
        wordFront: dto.wordFront,
        wordBack: dto.wordBack,
        audioUrl: dto.audioUrl ?? null,
        sequence: dto.sequence,
      },
    });
  }

  async createCardsBulk(sectionId: number, dto: BulkCardsDto) {
    await this.ensureSection(sectionId);
    await this.prisma.sectionCard.createMany({
      data: dto.cards.map((c) => ({
        sectionId,
        wordFront: c.wordFront,
        wordBack: c.wordBack,
        audioUrl: c.audioUrl ?? null,
        sequence: c.sequence,
      })),
    });
    return { created: dto.cards.length };
  }

  async patchCard(cardId: number, dto: PatchCardDto) {
    await this.ensureCard(cardId);
    return this.prisma.sectionCard.update({
      where: { id: cardId },
      data: {
        ...(dto.wordFront !== undefined && { wordFront: dto.wordFront }),
        ...(dto.wordBack !== undefined && { wordBack: dto.wordBack }),
        ...(dto.audioUrl !== undefined && { audioUrl: dto.audioUrl }),
        ...(dto.sequence !== undefined && { sequence: dto.sequence }),
      },
    });
  }

  async deleteCard(cardId: number) {
    await this.ensureCard(cardId);
    await this.prisma.sectionCard.delete({ where: { id: cardId } });
    return { deleted: true };
  }

  async createMaterial(sectionId: number, dto: CreateMaterialDto) {
    await this.ensureSection(sectionId);
    return this.prisma.sectionMaterial.create({
      data: {
        sectionId,
        type: dto.type,
        sequence: dto.sequence,
        isExtra: dto.isExtra ?? false,
        contentText: dto.contentText as Prisma.InputJsonValue,
      },
    });
  }

  async patchMaterial(materialId: number, dto: PatchMaterialDto) {
    await this.ensureMaterial(materialId);
    return this.prisma.sectionMaterial.update({
      where: { id: materialId },
      data: {
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.sequence !== undefined && { sequence: dto.sequence }),
        ...(dto.isExtra !== undefined && { isExtra: dto.isExtra }),
        ...(dto.contentText !== undefined && { contentText: dto.contentText as Prisma.InputJsonValue }),
      },
    });
  }

  async deleteMaterial(materialId: number) {
    await this.ensureMaterial(materialId);
    await this.prisma.sectionMaterial.delete({ where: { id: materialId } });
    return { deleted: true };
  }

  async createQuestion(sectionId: number, dto: CreateQuestionDto) {
    await this.ensureSection(sectionId);
    return this.prisma.sectionQuestion.create({
      data: {
        sectionId,
        type: dto.type,
        questionText: dto.questionText,
        options: dto.options as Prisma.InputJsonValue,
        answer: dto.answer,
        explanation: dto.explanation ?? null,
      },
    });
  }

  async patchQuestion(questionId: number, dto: PatchQuestionDto) {
    await this.ensureQuestion(questionId);
    return this.prisma.sectionQuestion.update({
      where: { id: questionId },
      data: {
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.questionText !== undefined && { questionText: dto.questionText }),
        ...(dto.options !== undefined && { options: dto.options as Prisma.InputJsonValue }),
        ...(dto.answer !== undefined && { answer: dto.answer }),
        ...(dto.explanation !== undefined && { explanation: dto.explanation }),
      },
    });
  }

  async deleteQuestion(questionId: number) {
    await this.ensureQuestion(questionId);
    await this.prisma.sectionQuestion.delete({ where: { id: questionId } });
    return { deleted: true };
  }

  async presignedAudioUpload(sectionId: number, dto: AdminAudioPresignedDto) {
    await this.ensureSection(sectionId);
    if (!this.bucket) {
      throw new AppException('S3_NOT_CONFIGURED', 'S3가 설정되지 않았습니다.', HttpStatus.SERVICE_UNAVAILABLE);
    }
    const key = `audio/sections/${sectionId}/${randomUUID()}.${dto.fileExtension.replace(/[^a-zA-Z0-9]/g, '')}`;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: dto.contentType,
    });
    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 3600 });
    const region = this.configService.get<string>('aws.region') ?? 'ap-northeast-2';
    const fileUrl = buildS3ObjectPublicUrl({
      cloudfrontBaseUrl: this.configService.get<string>('cloudfrontBaseUrl'),
      bucket: this.bucket,
      region,
      key,
    });
    return { uploadUrl, key, fileUrl };
  }

  private async ensureCourse(id: number) {
    const c = await this.prisma.course.findUnique({ where: { id } });
    if (!c) throw new AppException('COURSE_NOT_FOUND', '코스를 찾을 수 없습니다.', HttpStatus.NOT_FOUND);
  }

  private async ensureLesson(id: number) {
    const l = await this.prisma.lesson.findUnique({ where: { id } });
    if (!l) throw new AppException('LESSON_NOT_FOUND', '레슨을 찾을 수 없습니다.', HttpStatus.NOT_FOUND);
  }

  private async ensureSection(id: number) {
    const s = await this.prisma.section.findUnique({ where: { id } });
    if (!s) throw new AppException('SECTION_NOT_FOUND', '섹션을 찾을 수 없습니다.', HttpStatus.NOT_FOUND);
  }

  private async ensureCard(id: number) {
    const c = await this.prisma.sectionCard.findUnique({ where: { id } });
    if (!c) throw new AppException('CARD_NOT_FOUND', '카드를 찾을 수 없습니다.', HttpStatus.NOT_FOUND);
  }

  private async ensureMaterial(id: number) {
    const m = await this.prisma.sectionMaterial.findUnique({ where: { id } });
    if (!m) throw new AppException('MATERIAL_NOT_FOUND', '자료를 찾을 수 없습니다.', HttpStatus.NOT_FOUND);
  }

  private async ensureQuestion(id: number) {
    const q = await this.prisma.sectionQuestion.findUnique({ where: { id } });
    if (!q) throw new AppException('QUESTION_NOT_FOUND', '문제를 찾을 수 없습니다.', HttpStatus.NOT_FOUND);
  }
}
