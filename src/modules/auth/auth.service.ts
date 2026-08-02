import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomInt } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../infra/redis/redis.service';
import { EmailQueueService } from '../../infra/email/email-queue.service';
import { EmailService } from '../../infra/email/email.service';
import { AppException } from '../../common/exceptions/app.exception';
import { HttpStatus } from '@nestjs/common';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { PasswordResetConfirmDto } from './dto/password-reset-confirm.dto';
import { AchievementService } from '../achievement/achievement.service';

const OTP_TTL = 300;
const VERIFY_TTL = 1800;
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;
const REFRESH_PENDING_TTL_SECONDS = 5;
const REFRESH_RESULT_TTL_SECONDS = 10;
const REFRESH_RESULT_POLL_INTERVAL_MS = 50;
const REFRESH_RESULT_POLL_ATTEMPTS = 20;
const OTP_COOLDOWN_SECONDS = 60;
const OTP_MAX_FAILS = 5;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly googleClient: OAuth2Client | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailQueue: EmailQueueService,
    private readonly emailService: EmailService,
    private readonly achievementService: AchievementService,
  ) {
    const clientId = this.configService.get<string>('google.clientId');
    this.googleClient = clientId ? new OAuth2Client(clientId) : null;
  }

  private async generateUniqueUsername(email: string): Promise<string> {
    const local =
      email
        .split('@')[0]
        .replace(/[^a-zA-Z0-9_]/g, '')
        .slice(0, 20) || 'user';
    for (let i = 0; i < 20; i++) {
      const suffix = randomBytes(3).toString('hex').slice(0, 5);
      const candidate = `${local}_${suffix}`;
      const taken = await this.prisma.user.findUnique({ where: { username: candidate } });
      if (!taken) return candidate;
    }
    return `${local}_${Date.now().toString(36)}`;
  }

  private assertEmailConfigured(): void {
    const isProd = (this.configService.get<string>('nodeEnv') ?? '') === 'production';
    if (isProd && !this.emailService.isConfigured()) {
      throw new AppException(
        'EMAIL_NOT_CONFIGURED',
        '이메일 발송이 설정되지 않았습니다. Brevo SMTP(SMTP_HOST, SMTP_USER, SMTP_PASS)를 구성하세요.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async sendEmailCode(email: string): Promise<{ sent: boolean }> {
    this.assertEmailConfigured();
    const cooldownKey = `email:otp:cooldown:${email}`;
    const existingCooldown = await this.redis.get(cooldownKey);
    if (existingCooldown) {
      throw new AppException(
        'OTP_COOLDOWN',
        '인증 코드는 60초에 한 번만 요청할 수 있습니다.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = String(randomInt(100000, 1000000));
    const isProd = (this.configService.get<string>('nodeEnv') ?? '') === 'production';
    if (isProd) {
      this.logger.log('OTP requested (address and code omitted in production)');
    } else {
      this.logger.log(
        `OTP for ${email}: ${code} (실제 발송 시 메일함 확인, 미발송 시 이 로그 사용)`,
      );
    }
    const otpKey = `email:otp:${email}`;
    await this.redis.set(otpKey, code, OTP_TTL);
    await this.redis.set(cooldownKey, '1', OTP_COOLDOWN_SECONDS);
    await this.emailQueue.enqueueOtp(email, code, otpKey);
    return { sent: true };
  }

  async verifyEmailCode(email: string, code: string): Promise<{ verifyToken: string }> {
    const stored = await this.redis.get(`email:otp:${email}`);
    if (!stored || stored !== code) {
      if (stored) {
        const failKey = `email:otp:fail:${email}`;
        const fails = await this.redis.incrWithTtlOnFirst(failKey, OTP_TTL);
        if (fails > OTP_MAX_FAILS) {
          await this.redis.del(`email:otp:${email}`);
          await this.redis.del(failKey);
          throw new AppException(
            'OTP_ATTEMPTS_EXCEEDED',
            '인증 시도 횟수를 초과했습니다. 코드를 다시 요청하세요.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }
      throw new AppException(
        'INVALID_CODE',
        '인증 코드가 올바르지 않거나 만료되었습니다.',
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.redis.del(`email:otp:${email}`);
    await this.redis.del(`email:otp:fail:${email}`);
    const verifyToken = randomBytes(32).toString('hex');
    await this.redis.set(`signup:verify:${verifyToken}`, email, VERIFY_TTL);
    return { verifyToken };
  }

  async signup(dto: SignupDto) {
    if (!dto.isTermsAgreed || !dto.isPrivacyAgreed || !dto.isAgeVerified) {
      throw new AppException(
        'TERMS_NOT_AGREED',
        '필수 약관에 동의해야 가입할 수 있습니다.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const emailFromRedis = await this.redis.get(`signup:verify:${dto.verifyToken}`);
    if (!emailFromRedis || emailFromRedis !== dto.email) {
      throw new AppException(
        'INVALID_VERIFY_TOKEN',
        '이메일 인증이 완료되지 않았거나 토큰이 만료되었습니다.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new AppException('EMAIL_EXISTS', '이미 가입된 이메일입니다.', HttpStatus.CONFLICT);
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const username = await this.generateUniqueUsername(dto.email);
    const tempNickname = await this.generateTempNickname(dto.email);
    const user = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          nickname: tempNickname,
          username,
          isTermsAgreed: true,
          isPrivacyAgreed: true,
          isAgeVerified: true,
          isMarketingAgreed: dto.isMarketingAgreed ?? false,
        },
      });
      await tx.userStats.create({
        data: { userId: u.id },
      });
      await this.achievementService.awardByKey(tx, u.id, 'signed_up');
      return u;
    });
    await this.redis.del(`signup:verify:${dto.verifyToken}`);
    return this.issueTokens(user.id, user.email, user.sessionVersion);
  }

  private async generateTempNickname(email: string): Promise<string> {
    const local = email.split('@')[0].slice(0, 20) || 'user';
    for (let i = 0; i < 10; i++) {
      const suffix = randomBytes(2).toString('hex');
      const candidate = `${local}_${suffix}`;
      const taken = await this.prisma.user.findFirst({ where: { nickname: candidate } });
      if (!taken) return candidate;
    }
    return `user_${Date.now().toString(36)}`;
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.passwordHash) {
      throw new AppException(
        'INVALID_CREDENTIALS',
        '이메일 또는 비밀번호가 올바르지 않습니다.',
        HttpStatus.UNAUTHORIZED,
      );
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new AppException(
        'INVALID_CREDENTIALS',
        '이메일 또는 비밀번호가 올바르지 않습니다.',
        HttpStatus.UNAUTHORIZED,
      );
    }
    return this.issueTokens(user.id, user.email, user.sessionVersion);
  }

  async googleAuth(dto: GoogleAuthDto) {
    if (!this.googleClient) {
      throw new AppException(
        'GOOGLE_NOT_CONFIGURED',
        'Google OAuth가 설정되지 않았습니다.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    let ticket;
    try {
      ticket = await this.googleClient.verifyIdToken({
        idToken: dto.idToken,
        audience: this.configService.get<string>('google.clientId'),
      });
    } catch (error) {
      this.logger.warn(
        `Google ID token verification failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new AppException(
        'INVALID_GOOGLE_TOKEN',
        'Google 토큰이 유효하지 않습니다.',
        HttpStatus.UNAUTHORIZED,
      );
    }
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.sub) {
      throw new AppException(
        'INVALID_GOOGLE_TOKEN',
        'Google 토큰이 유효하지 않습니다.',
        HttpStatus.UNAUTHORIZED,
      );
    }
    const email = payload.email;
    const sub = payload.sub;
    let user = await this.prisma.user.findFirst({
      where: { socialProvider: 'google', socialUid: sub },
    });
    let isNewUser = false;
    if (!user) {
      const existingEmail = await this.prisma.user.findUnique({ where: { email } });
      if (existingEmail) {
        user = await this.prisma.user.update({
          where: { id: existingEmail.id },
          data: { socialProvider: 'google', socialUid: sub },
        });
      } else {
        const baseUsername =
          (payload.name ?? email.split('@')[0]).replace(/[^a-zA-Z0-9_]/g, '').slice(0, 40) ||
          `user${sub.slice(0, 8)}`;
        let username = baseUsername;
        let suffix = 0;
        while (await this.prisma.user.findUnique({ where: { username } })) {
          suffix += 1;
          username = `${baseUsername}${suffix}`;
        }
        user = await this.prisma.$transaction(async (tx) => {
          const u = await tx.user.create({
            data: {
              email,
              passwordHash: null,
              nickname: payload.name ?? username,
              username,
              profileImgUrl: payload.picture ?? null,
              socialProvider: 'google',
              socialUid: sub,
            },
          });
          await tx.userStats.create({ data: { userId: u.id } });
          await this.achievementService.awardByKey(tx, u.id, 'signed_up');
          return u;
        });
        isNewUser = true;
      }
    }
    const tokens = await this.issueTokens(user.id, user.email, user.sessionVersion);
    return { ...tokens, isNewUser };
  }

  async refresh(refreshToken: string) {
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const resultKey = `refresh:result:${tokenHash}`;
    const pendingKey = `refresh:pending:${tokenHash}`;
    const cachedResult = await this.redis.get(resultKey);
    if (cachedResult) {
      return JSON.parse(cachedResult) as Awaited<ReturnType<AuthService['issueTokens']>>;
    }

    let storedTokenId = tokenHash;
    let userIdStr = await this.redis.claimRefreshToken(
      `refresh:${tokenHash}`,
      pendingKey,
      REFRESH_PENDING_TTL_SECONDS,
    );
    // Transitional fallback for refresh tokens issued before hashed storage was deployed.
    if (!userIdStr) {
      storedTokenId = refreshToken;
      userIdStr = await this.redis.claimRefreshToken(
        `refresh:${refreshToken}`,
        pendingKey,
        REFRESH_PENDING_TTL_SECONDS,
      );
    }
    if (!userIdStr) {
      if (await this.redis.get(pendingKey)) {
        for (let attempt = 0; attempt < REFRESH_RESULT_POLL_ATTEMPTS; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, REFRESH_RESULT_POLL_INTERVAL_MS));
          const concurrentResult = await this.redis.get(resultKey);
          if (concurrentResult) {
            return JSON.parse(concurrentResult) as Awaited<ReturnType<AuthService['issueTokens']>>;
          }
        }
      }
      throw new AppException(
        'INVALID_TOKEN',
        '리프레시 토큰이 유효하지 않습니다.',
        HttpStatus.UNAUTHORIZED,
      );
    }
    const [storedUserId, storedSessionVersionRaw] = userIdStr.split(':', 2);
    const storedSessionVersion = Number(storedSessionVersionRaw ?? 0);
    const user = await this.prisma.user.findUnique({ where: { id: BigInt(storedUserId) } });
    if (
      !user ||
      !Number.isSafeInteger(storedSessionVersion) ||
      user.sessionVersion !== storedSessionVersion
    ) {
      await this.redis.del(pendingKey);
      if (user) {
        await this.redis.sRem(`user:tokens:${user.id}`, storedTokenId);
      }
      throw new AppException(
        'INVALID_TOKEN',
        'Refresh token is invalid or has been revoked.',
        HttpStatus.UNAUTHORIZED,
      );
    }
    try {
      const tokens = await this.issueTokens(user.id, user.email, user.sessionVersion);
      await this.redis.set(resultKey, JSON.stringify(tokens), REFRESH_RESULT_TTL_SECONDS);
      await this.redis.sRem(`user:tokens:${user.id}`, storedTokenId);
      await this.redis.del(pendingKey);
      return tokens;
    } catch (error) {
      await Promise.all([
        this.redis.set(`refresh:${storedTokenId}`, userIdStr, REFRESH_TTL_SECONDS),
        this.redis.del(pendingKey),
      ]);
      throw error;
    }
  }

  async logout(refreshToken: string): Promise<{ loggedOut: boolean }> {
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    let storedTokenId = tokenHash;
    let userIdStr = await this.redis.getAndDel(`refresh:${tokenHash}`);
    if (!userIdStr) {
      storedTokenId = refreshToken;
      userIdStr = await this.redis.getAndDel(`refresh:${refreshToken}`);
    }
    if (userIdStr) {
      const [storedUserId] = userIdStr.split(':', 1);
      await this.redis.sRem(`user:tokens:${storedUserId}`, storedTokenId);
    }
    return { loggedOut: true };
  }

  async passwordResetRequest(email: string): Promise<{ sent: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      this.logger.log('[password-reset] request completed without a local account match');
      return { sent: true };
    }

    this.assertEmailConfigured();

    const cooldownKey = `pwdreset:otp:cooldown:${email}`;
    if (await this.redis.get(cooldownKey)) {
      throw new AppException(
        'OTP_COOLDOWN',
        '인증 코드는 60초에 한 번만 요청할 수 있습니다.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = String(randomInt(100000, 1000000));
    const isProd = (this.configService.get<string>('nodeEnv') ?? '') === 'production';
    if (isProd) {
      this.logger.log('Password reset OTP requested (address and code omitted in production)');
    } else {
      this.logger.log(`Password reset OTP for ${email}: ${code}`);
    }
    const otpKey = `pwdreset:otp:${email}`;
    await this.redis.set(otpKey, code, OTP_TTL);
    await this.redis.set(cooldownKey, '1', OTP_COOLDOWN_SECONDS);
    await this.emailQueue.enqueueOtp(email, code, otpKey);
    return { sent: true };
  }

  async passwordResetConfirm(dto: PasswordResetConfirmDto): Promise<{ reset: boolean }> {
    const stored = await this.redis.get(`pwdreset:otp:${dto.email}`);
    if (!stored || stored !== dto.code) {
      if (stored) {
        const failKey = `pwdreset:otp:fail:${dto.email}`;
        const fails = await this.redis.incrWithTtlOnFirst(failKey, OTP_TTL);
        if (fails > OTP_MAX_FAILS) {
          await this.redis.del(`pwdreset:otp:${dto.email}`);
          await this.redis.del(failKey);
          throw new AppException(
            'OTP_ATTEMPTS_EXCEEDED',
            '인증 시도 횟수를 초과했습니다. 코드를 다시 요청하세요.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }
      throw new AppException(
        'INVALID_CODE',
        '인증 코드가 올바르지 않거나 만료되었습니다.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.passwordHash) {
      await this.redis.del(`pwdreset:otp:${dto.email}`);
      await this.redis.del(`pwdreset:otp:fail:${dto.email}`);
      throw new AppException('USER_NOT_FOUND', '사용자를 찾을 수 없습니다.', HttpStatus.NOT_FOUND);
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });

    // 비밀번호 변경 후 해당 사용자의 모든 활성 세션 무효화
    const userTokensKey = `user:tokens:${user.id}`;
    const activeTokens = await this.redis.sMembers(userTokensKey);
    await this.redis.delMany([
      ...activeTokens.map((t) => `refresh:${t}`), // 리프레시 토큰 전체 삭제
      `jwt:user:${user.id}`, // 액세스 토큰 캐시 무효화
      userTokensKey, // 인덱스 정리
      `pwdreset:otp:${dto.email}`,
      `pwdreset:otp:fail:${dto.email}`,
    ]);

    return { reset: true };
  }

  async checkNicknameAvailable(nickname: string): Promise<{ available: boolean }> {
    const taken = await this.prisma.user.findFirst({ where: { nickname } });
    return { available: !taken };
  }

  private async issueTokens(userId: bigint, email: string, sessionVersion = 0) {
    const accessSecret = this.configService.get<string>('jwt.accessSecret');
    const accessExpiresIn = this.configService.get<string>('jwt.accessExpiresIn') ?? '30m';

    const accessToken = await this.jwtService.signAsync(
      { sub: userId.toString(), email, sv: sessionVersion },
      { secret: accessSecret, expiresIn: accessExpiresIn },
    );

    const refreshToken = randomBytes(48).toString('hex');
    const refreshTokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const userTokensKey = `user:tokens:${userId}`;
    await Promise.all([
      this.redis.set(
        `refresh:${refreshTokenHash}`,
        `${userId}:${sessionVersion}`,
        REFRESH_TTL_SECONDS,
      ),
      // 역방향 인덱스: 사용자별 활성 리프레시 토큰 집합 (비밀번호 재설정 시 일괄 무효화에 사용)
      this.redis.sAdd(userTokensKey, refreshTokenHash),
      this.redis.expire(userTokensKey, REFRESH_TTL_SECONDS + 3600),
    ]);

    return {
      userId: userId.toString(),
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: accessExpiresIn,
    };
  }
}
