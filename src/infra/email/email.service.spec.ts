import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EmailService } from './email.service';

const sendMailMock = jest.fn();

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: sendMailMock })),
}));

describe('EmailService', () => {
  let service: EmailService;

  const buildModule = async (config: Record<string, unknown>) => {
    const mockConfig = {
      get: jest.fn((key: string) => {
        const map: Record<string, unknown> = {
          emailFrom: 'noreply@app.dojeonkr.com',
          emailFromName: 'DOJEON',
          'smtp.host': config.host ?? '',
          'smtp.user': config.user ?? '',
          'smtp.pass': config.pass ?? '',
          'smtp.port': config.port ?? 587,
          'smtp.secure': config.secure ?? false,
        };
        return map[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailService, { provide: ConfigService, useValue: mockConfig }],
    }).compile();

    return module.get<EmailService>(EmailService);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    sendMailMock.mockReset();
  });

  it('should be defined with SMTP disabled when credentials missing', async () => {
    service = await buildModule({});
    expect(service).toBeDefined();
    expect(service.isConfigured()).toBe(false);
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });

  it('should log only when SMTP is not configured', async () => {
    service = await buildModule({});
    const result = await service.sendOtpEmail('user@test.com', '123456');
    expect(result).toBe(false);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('should send OTP via SMTP when configured', async () => {
    service = await buildModule({
      host: 'smtp-relay.brevo.com',
      user: 'smtp-login@brevo.com',
      pass: 'smtp-key',
      port: 587,
      secure: false,
    });
    expect(service.isConfigured()).toBe(true);
    sendMailMock.mockResolvedValue({ messageId: 'id' });

    const result = await service.sendOtpEmail('user@test.com', '123456');

    expect(result).toBe(true);
    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: { user: 'smtp-login@brevo.com', pass: 'smtp-key' },
    });
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '"DOJEON" <noreply@app.dojeonkr.com>',
        to: 'user@test.com',
        subject: '[DOJEON] 이메일 인증 코드',
        text: expect.stringContaining('123456'),
      }),
    );
  });

  it('should throw when SMTP sendMail fails', async () => {
    service = await buildModule({
      host: 'smtp-relay.brevo.com',
      user: 'smtp-login@brevo.com',
      pass: 'smtp-key',
    });
    sendMailMock.mockRejectedValue(new Error('SMTP rejected'));

    await expect(service.sendOtpEmail('user@test.com', '123456')).rejects.toThrow('SMTP rejected');
  });
});
