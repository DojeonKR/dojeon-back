import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/** OTP·임시비밀번호 메일은 BullMQ 워커에서 Brevo SMTP 릴레이로 발송합니다. */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter | null;
  private readonly fromAddress: string;

  constructor(private readonly configService: ConfigService) {
    const emailFrom = this.configService.get<string>('emailFrom') ?? 'noreply@app.dojeonkr.com';
    const emailFromName = this.configService.get<string>('emailFromName') ?? 'DOJEON';
    this.fromAddress = `"${emailFromName}" <${emailFrom}>`;

    const host = (this.configService.get<string>('smtp.host') ?? '').trim();
    const user = (this.configService.get<string>('smtp.user') ?? '').trim();
    const pass = (this.configService.get<string>('smtp.pass') ?? '').trim();
    const port = this.configService.get<number>('smtp.port') ?? 587;
    const secure = this.configService.get<boolean>('smtp.secure') ?? false;

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
    } else {
      this.transporter = null;
      this.logger.warn('SMTP not configured (SMTP_HOST, SMTP_USER, SMTP_PASS) — outbound email will only be logged.');
    }
  }

  isConfigured(): boolean {
    return this.transporter !== null;
  }

  /** @returns true if mail was sent via SMTP */
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
    if (!this.transporter) {
      this.logger.log(`[DEV EMAIL] To: ${to} | Subject: ${subject}\n${body}`);
      return false;
    }
    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to,
        subject,
        text: body,
      });
      this.logger.log(`Email sent via SMTP to ${to}`);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`SMTP send failed to ${to}: ${message}`);
      throw err instanceof Error ? err : new Error(message);
    }
  }
}
