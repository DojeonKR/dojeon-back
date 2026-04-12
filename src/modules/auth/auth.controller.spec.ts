import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RedisService } from '../../infra/redis/redis.service';

describe('AuthController', () => {
  let controller: AuthController;
  let mockAuthService: any;

  beforeEach(async () => {
    mockAuthService = {
      sendEmailCode: jest.fn(),
      verifyEmailCode: jest.fn(),
      signup: jest.fn(),
      login: jest.fn(),
      googleAuth: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
      passwordResetRequest: jest.fn(),
      passwordResetConfirm: jest.fn(),
      checkNicknameAvailable: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: RedisService, useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() } },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should send email code', async () => {
    mockAuthService.sendEmailCode.mockResolvedValue({ sent: true });
    const res = await controller.sendCode({ email: 'test@test.com' });
    expect(res).toEqual({ sent: true });
    expect(mockAuthService.sendEmailCode).toHaveBeenCalledWith('test@test.com');
  });

  it('should verify email code', async () => {
    mockAuthService.verifyEmailCode.mockResolvedValue({ verifyToken: 'token123' });
    const res = await controller.verifyCode({ email: 'test@test.com', code: '123456' });
    expect(res).toEqual({ verifyToken: 'token123' });
    expect(mockAuthService.verifyEmailCode).toHaveBeenCalledWith('test@test.com', '123456');
  });

  it('should check nickname availability', async () => {
    mockAuthService.checkNicknameAvailable.mockResolvedValue({ available: true });
    const res = await controller.checkNickname('newnick');
    expect(res).toEqual({ available: true });
    expect(mockAuthService.checkNicknameAvailable).toHaveBeenCalledWith('newnick');
  });
  
  it('should return false for empty nickname check', async () => {
    const res = await controller.checkNickname('');
    expect(res).toEqual({ available: false });
    expect(mockAuthService.checkNicknameAvailable).not.toHaveBeenCalled();
  });
});
