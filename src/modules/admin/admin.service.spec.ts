import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { AchievementService } from '../achievement/achievement.service';

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(),
  PutObjectCommand: jest.fn(),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://mock-presigned-url.com'),
}));

describe('AdminService', () => {
  let service: AdminService;
  let mockPrismaService: any;
  let mockConfigService: any;
  const mockAchievementService = { refreshBadges: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    mockPrismaService = {
      course: { create: jest.fn(), update: jest.fn(), delete: jest.fn(), findUnique: jest.fn() },
      lesson: { create: jest.fn(), update: jest.fn(), delete: jest.fn(), findUnique: jest.fn() },
      section: { create: jest.fn(), update: jest.fn(), delete: jest.fn(), findUnique: jest.fn() },
      sectionCard: { create: jest.fn(), createMany: jest.fn(), update: jest.fn(), delete: jest.fn(), findUnique: jest.fn() },
      sectionMaterial: { create: jest.fn(), update: jest.fn(), delete: jest.fn(), findUnique: jest.fn() },
      sectionQuestion: { create: jest.fn(), update: jest.fn(), delete: jest.fn(), findUnique: jest.fn() },
    };

    mockConfigService = {
      get: jest.fn((key) => {
        if (key === 'aws.region') return 'ap-northeast-2';
        if (key === 'aws.s3Bucket') return 'test-bucket';
        if (key === 'cloudfrontBaseUrl') return 'https://d123.cloudfront.net';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: AchievementService, useValue: mockAchievementService },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('course operations', () => {
    it('should create course', async () => {
      mockPrismaService.course.create.mockResolvedValue({ id: 1, title: 'C1' });
      const res = await service.createCourse({ title: 'C1', orderNum: 1 });
      expect(res.id).toBe(1);
    });

    it('should patch course', async () => {
      mockPrismaService.course.findUnique.mockResolvedValue({ id: 1 });
      mockPrismaService.course.update.mockResolvedValue({ id: 1, title: 'C1_U' });
      const res = await service.patchCourse(1, { title: 'C1_U' });
      expect(res.title).toBe('C1_U');
    });

    it('should delete course', async () => {
      mockPrismaService.course.findUnique.mockResolvedValue({ id: 1 });
      mockPrismaService.course.delete.mockResolvedValue({ id: 1 });
      const res = await service.deleteCourse(1);
      expect(res.deleted).toBe(true);
    });
  });

  describe('lesson operations', () => {
    it('should create lesson', async () => {
      mockPrismaService.course.findUnique.mockResolvedValue({ id: 1 });
      mockPrismaService.lesson.create.mockResolvedValue({ id: 1, title: 'L1' });
      const res = await service.createLesson(1, { title: 'L1', orderNum: 1 });
      expect(res.id).toBe(1);
    });
  });

  describe('section operations', () => {
    it('should create section', async () => {
      mockPrismaService.lesson.findUnique.mockResolvedValue({ id: 1 });
      mockPrismaService.section.create.mockResolvedValue({ id: 1, type: 'VOCAB' });
      const res = await service.createSection(1, { title: 'S1', type: 'VOCAB', orderNum: 1, totalPages: 10 });
      expect(res.id).toBe(1);
    });
  });

  describe('card operations', () => {
    it('should create bulk cards', async () => {
      mockPrismaService.section.findUnique.mockResolvedValue({ id: 1 });
      mockPrismaService.sectionCard.createMany.mockResolvedValue({ count: 2 });
      const res = await service.createCardsBulk(1, { cards: [{ wordFront: '1', wordBack: '2', sequence: 1 }] });
      expect(res.created).toBe(1);
    });
  });

  describe('audio presigned', () => {
    it('should return url for audio', async () => {
      mockPrismaService.section.findUnique.mockResolvedValue({ id: 1 });
      const res = await service.presignedAudioUpload(1, { fileExtension: 'mp3', contentType: 'audio/mpeg' });
      expect(res.uploadUrl).toBe('https://mock-presigned-url.com');
      expect(res.fileUrl).toContain('cloudfront');
    });
  });
});
