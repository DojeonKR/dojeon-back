import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

/** OTP·임시비밀번호 메일은 BullMQ 워커에서 이 서비스를 통해 Resend로 발송합니다. */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    this.from = this.configService.get<string>('emailFrom') ?? 'noreply@dojeon.local';
    const apiKey = (this.configService.get<string>('resendApiKey') ?? '').trim();
    this.resend = apiKey ? new Resend(apiKey) : null;
    if (!this.resend) {
      this.logger.warn('RESEND_API_KEY not set — outbound email will only be logged.');
    }
  }

  /** @returns true if mail was handed to Resend */
  async sendOtpEmail(to: string, code: string): Promise<boolean> {
    const subject = '[DOJEON] 이메일 인증 코드';
    const body = `
안녕하세요, DOJEON입니다.

이메일 인증 코드: ${code}

이 코드는 5분간 유효합니다.
본인이 요청하지 않은 경우 이 이메일을 무시하세요.
`.trim();

    return this.send(to, subject, body);
  }

  async sendTempPasswordEmail(to: string, tempPassword: string): Promise<boolean> {
    const subject = '[DOJEON] 임시 비밀번호 안내';
    const body = `
안녕하세요, DOJEON입니다.

임시 비밀번호: ${tempPassword}

로그인 후 반드시 비밀번호를 변경해 주세요.
본인이 요청하지 않은 경우 고객센터에 문의하세요.
`.trim();

    return this.send(to, subject, body);
  }

  private async send(to: string, subject: string, body: string): Promise<boolean> {
    if (!this.resend) {
      this.logger.log(`[DEV EMAIL] To: ${to} | Subject: ${subject}\n${body}`);
      return false;
    }
    const res = await this.resend.emails.send({
      from: this.from,
      to: [to],
      subject,
      text: body,
    });
    if (res.error) {
      this.logger.error(`Resend send failed to ${to}: ${res.error.message}`);
      throw new Error(res.error.message);
    }
    this.logger.log(`Email sent via Resend to ${to}`);
    return true;
  }
}
