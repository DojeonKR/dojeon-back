import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/** 인증 OTP 메일은 AuthService에서 동기(await) 발송 유지. 비OTP 알림·배치 메일은 추후 BullMQ/SQS 검토. */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly sesClient: SESClient | null;
  private readonly smtpTransport: Transporter | null;
  private readonly from: string;
  private readonly isDev: boolean;

  constructor(private readonly configService: ConfigService) {
    this.from = this.configService.get<string>('emailFrom') ?? 'noreply@dojeon.local';
    this.isDev = (this.configService.get<string>('nodeEnv') ?? 'development') !== 'production';

    const accessKeyId = this.configService.get<string>('aws.accessKeyId');
    const secretAccessKey = this.configService.get<string>('aws.secretAccessKey');
    const region = this.configService.get<string>('aws.region') ?? 'ap-northeast-2';

    if (accessKeyId && secretAccessKey) {
      this.sesClient = new SESClient({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });
    } else {
      this.sesClient = null;
    }

    const smtpHost = this.configService.get<string>('smtp.host')?.trim() ?? '';
    const smtpUser = this.configService.get<string>('smtp.user')?.trim() ?? '';
    const smtpPass = this.configService.get<string>('smtp.pass') ?? '';
    const smtpPort = this.configService.get<number>('smtp.port') ?? 587;
    const smtpSecure = this.configService.get<boolean>('smtp.secure') ?? false;

    if (smtpHost && smtpUser && smtpPass) {
      this.smtpTransport = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: { user: smtpUser, pass: smtpPass },
      });
      this.logger.log(`SMTP configured (host=${smtpHost}, port=${smtpPort})`);
    } else {
      this.smtpTransport = null;
    }

    if (!this.sesClient && !this.smtpTransport) {
      this.logger.warn(
        'No email transport (set AWS keys for SES, or SMTP_HOST/SMTP_USER/SMTP_PASS for Gmail etc.) — OTP will only appear in server logs.',
      );
    }
  }

  /** @returns true if mail was actually handed to SES/SMTP */
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
    // 1) SES — 운영(NODE_ENV=production)에서 AWS 자격 증명이 있을 때
    if (this.sesClient && !this.isDev) {
      try {
        await this.sesClient.send(
          new SendEmailCommand({
            Source: this.from,
            Destination: { ToAddresses: [to] },
            Message: {
              Subject: { Data: subject, Charset: 'UTF-8' },
              Body: { Text: { Data: body, Charset: 'UTF-8' } },
            },
          }),
        );
        this.logger.log(`Email sent via SES to ${to}`);
        return true;
      } catch (err) {
        this.logger.error(`SES send failed to ${to}: ${String(err)}`);
        throw err;
      }
    }

    // 2) SMTP — Gmail 등 (개발/운영 모두, SES 미사용 또는 로컬에서 실메일 테스트 시)
    if (this.smtpTransport) {
      try {
        await this.smtpTransport.sendMail({
          from: this.from,
          to,
          subject,
          text: body,
        });
        this.logger.log(`Email sent via SMTP to ${to}`);
        return true;
      } catch (err) {
        this.logger.error(`SMTP send failed to ${to}: ${String(err)}`);
        throw err;
      }
    }

    this.logger.log(`[DEV EMAIL] To: ${to} | Subject: ${subject}\n${body}`);
    return false;
  }
}
