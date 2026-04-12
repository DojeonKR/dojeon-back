import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';

describe('UserController', () => {
  let controller: UserController;
  let mockUserService: any;

  beforeEach(async () => {
    mockUserService = {
      getDashboard: jest.fn(),
      patchMe: jest.fn(),
      changePassword: jest.fn(),
      getAchievementsList: jest.fn(),
      createProfileImagePresignedUrl: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        { provide: UserService, useValue: mockUserService },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return dashboard', async () => {
    mockUserService.getDashboard.mockResolvedValue({ profile: {} });
    const res = await controller.getMe({ userId: 1n } as any, '2026', '4');
    expect(res).toEqual({ profile: {} });
    expect(mockUserService.getDashboard).toHaveBeenCalledWith(1n, 2026, 4);
  });

  it('should patch me', async () => {
    mockUserService.patchMe.mockResolvedValue({ updated: true });
    const res = await controller.patchMe({ userId: 1n } as any, { nickname: 'test' });
    expect(res).toEqual({ updated: true });
    expect(mockUserService.patchMe).toHaveBeenCalledWith(1n, { nickname: 'test' });
  });

  it('should change password', async () => {
    mockUserService.changePassword.mockResolvedValue({ updated: true });
    const res = await controller.changePassword({ userId: 1n } as any, { currentPassword: 'old', newPassword: 'new' });
    expect(res).toEqual({ updated: true });
  });

  it('should get achievements', async () => {
    mockUserService.getAchievementsList.mockResolvedValue({ badges: [] });
    const res = await controller.getAchievements({ userId: 1n } as any);
    expect(res).toEqual({ badges: [] });
  });

  it('should get presigned url', async () => {
    mockUserService.createProfileImagePresignedUrl.mockResolvedValue({ uploadUrl: 'http' });
    const res = await controller.presignedProfileImage({ userId: 1n } as any, { fileExtension: 'jpg', contentType: 'image/jpeg' });
    expect(res).toEqual({ uploadUrl: 'http' });
  });
});
