import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly client: SESClient | null;
  private readonly from: string;
  private readonly isDev: boolean;

  constructor(private readonly configService: ConfigService) {
    this.from = this.configService.get<string>('emailFrom') ?? 'noreply@dojeon.local';
    this.isDev = (this.configService.get<string>('nodeEnv') ?? 'development') !== 'production';

    const accessKeyId = this.configService.get<string>('aws.accessKeyId');
    const secretAccessKey = this.configService.get<string>('aws.secretAccessKey');
    const region = this.configService.get<string>('aws.region') ?? 'ap-northeast-2';

    if (accessKeyId && secretAccessKey) {
      this.client = new SESClient({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });
    } else {
      this.client = null;
      this.logger.warn('AWS credentials not set — email will be logged only (dev mode)');
    }
  }

  async sendOtpEmail(to: string, code: string): Promise<void> {
    const subject = '[DOJEON] 이메일 인증 코드';
    const body = `
안녕하세요, DOJEON입니다.

이메일 인증 코드: ${code}

이 코드는 5분간 유효합니다.
본인이 요청하지 않은 경우 이 이메일을 무시하세요.
`.trim();

    await this.send(to, subject, body);
  }

  async sendTempPasswordEmail(to: string, tempPassword: string): Promise<void> {
    const subject = '[DOJEON] 임시 비밀번호 안내';
    const body = `
안녕하세요, DOJEON입니다.

임시 비밀번호: ${tempPassword}

로그인 후 반드시 비밀번호를 변경해 주세요.
본인이 요청하지 않은 경우 고객센터에 문의하세요.
`.trim();

    await this.send(to, subject, body);
  }

  private async send(to: string, subject: string, body: string): Promise<void> {
    if (this.isDev || !this.client) {
      this.logger.log(`[DEV EMAIL] To: ${to} | Subject: ${subject}\n${body}`);
      return;
    }

    try {
      await this.client.send(
        new SendEmailCommand({
          Source: this.from,
          Destination: { ToAddresses: [to] },
          Message: {
            Subject: { Data: subject, Charset: 'UTF-8' },
            Body: { Text: { Data: body, Charset: 'UTF-8' } },
          },
        }),
      );
    } catch (err) {
      this.logger.error(`SES send failed to ${to}: ${String(err)}`);
      throw err;
    }
  }
}
