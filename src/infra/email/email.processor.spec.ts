import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { EmailProcessor, OtpEmailJob } from './email.processor';
import { EmailService } from './email.service';
import { RedisService } from '../redis/redis.service';

describe('EmailProcessor', () => {
  let processor: EmailProcessor;
  let mockEmailService: { sendOtpEmail: jest.Mock };
  let mockRedis: { get: jest.Mock };

  beforeEach(async () => {
    mockEmailService = { sendOtpEmail: jest.fn().mockResolvedValue(true) };
    mockRedis = { get: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailProcessor,
        { provide: EmailService, useValue: mockEmailService },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    processor = module.get<EmailProcessor>(EmailProcessor);
  });

  it('should skip sending when job code no longer matches Redis (stale job)', async () => {
    mockRedis.get.mockResolvedValue('999999');
    const job = {
      id: '1',
      data: {
        type: 'otp',
        to: 'user@test.com',
        code: '111111',
        otpRedisKey: 'email:otp:user@test.com',
      },
    } as Job<OtpEmailJob>;

    const result = await processor.process(job);

    expect(result).toBe(true);
    expect(mockEmailService.sendOtpEmail).not.toHaveBeenCalled();
  });

  it('should send when job code matches Redis', async () => {
    mockRedis.get.mockResolvedValue('111111');
    const job = {
      id: '2',
      data: {
        type: 'otp',
        to: 'user@test.com',
        code: '111111',
        otpRedisKey: 'email:otp:user@test.com',
      },
    } as Job<OtpEmailJob>;

    await processor.process(job);

    expect(mockEmailService.sendOtpEmail).toHaveBeenCalledWith('user@test.com', '111111');
  });
});
