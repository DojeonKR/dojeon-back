import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AdminController', () => {
  let controller: AdminController;
  let mockAdminService: any;
  let mockPrismaService: any;

  beforeEach(async () => {
    mockAdminService = {
      createCourse: jest.fn(),
      patchCourse: jest.fn(),
      deleteCourse: jest.fn(),
      createLesson: jest.fn(),
      patchLesson: jest.fn(),
      deleteLesson: jest.fn(),
      createSection: jest.fn(),
      patchSection: jest.fn(),
      deleteSection: jest.fn(),
      createCard: jest.fn(),
      createCardsBulk: jest.fn(),
      patchCard: jest.fn(),
      deleteCard: jest.fn(),
      createMaterial: jest.fn(),
      patchMaterial: jest.fn(),
      deleteMaterial: jest.fn(),
      createQuestion: jest.fn(),
      patchQuestion: jest.fn(),
      deleteQuestion: jest.fn(),
      presignedAudioUpload: jest.fn(),
    };

    mockPrismaService = {};

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: AdminService, useValue: mockAdminService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create course', async () => {
    mockAdminService.createCourse.mockResolvedValue({ id: 1 });
    const res = await controller.createCourse({ title: 'Course', orderNum: 1 });
    expect(res).toEqual({ id: 1 });
    expect(mockAdminService.createCourse).toHaveBeenCalled();
  });
  
  it('should patch course', async () => {
    mockAdminService.patchCourse.mockResolvedValue({ id: 1 });
    const res = await controller.patchCourse(1, { title: 'Course' });
    expect(res).toEqual({ id: 1 });
  });

  it('should delete course', async () => {
    mockAdminService.deleteCourse.mockResolvedValue({ deleted: true });
    const res = await controller.deleteCourse(1);
    expect(res).toEqual({ deleted: true });
  });

  // Similarly simplified controller routing tests for lesson/section/cards etc.
  it('should create lesson', async () => {
    mockAdminService.createLesson.mockResolvedValue({ id: 1 });
    const res = await controller.createLesson(1, { title: 'L1', orderNum: 1 });
    expect(res).toEqual({ id: 1 });
  });
});
