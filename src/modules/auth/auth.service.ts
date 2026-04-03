import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../infra/redis/redis.service';
import { EmailService } from '../../infra/email/email.service';
import { AppException } from '../../common/exceptions/app.exception';
import { HttpStatus } from '@nestjs/common';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';

const OTP_TTL = 300;
const VERIFY_TTL = 1800;
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly googleClient: OAuth2Client | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {
    const clientId = this.configService.get<string>('google.clientId');
    this.googleClient = clientId ? new OAuth2Client(clientId) : null;
  }

  private async generateUniqueUsername(email: string): Promise<string> {
    const local = email
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

  async sendEmailCode(email: string): Promise<{ sent: boolean }> {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await this.redis.set(`email:otp:${email}`, code, OTP_TTL);
    this.logger.log(`[DEV] OTP for ${email}: ${code}`);
    await this.emailService.sendOtpEmail(email, code);
    return { sent: true };
  }

  async verifyEmailCode(email: string, code: string): Promise<{ verifyToken: string }> {
    const stored = await this.redis.get(`email:otp:${email}`);
    if (!stored || stored !== code) {
      throw new AppException('INVALID_OTP', '인증번호가 올바르지 않습니다.', HttpStatus.BAD_REQUEST);
    }
    await this.redis.del(`email:otp:${email}`);
    const verifyToken = randomBytes(32).toString('hex');
    await this.redis.set(`signup:verify:${verifyToken}`, email, VERIFY_TTL);
    return { verifyToken };
  }

  async signup(dto: SignupDto) {
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
    const nicknameTaken = await this.prisma.user.findFirst({ where: { nickname: dto.nickname } });
    if (nicknameTaken) {
      throw new AppException('NICKNAME_EXISTS', '이미 사용 중인 닉네임입니다.', HttpStatus.CONFLICT);
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const username = await this.generateUniqueUsername(dto.email);
    const user = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          nickname: dto.nickname,
          username,
          motherLanguage: dto.motherLanguage ?? null,
          proficiencyLevel: dto.proficiencyLevel ?? null,
          ageGroup: dto.ageGroup ?? null,
          dailyGoalMin: dto.dailyGoalMin ?? null,
        },
      });
      await tx.userStats.create({
        data: { userId: u.id },
      });
      return u;
    });
    await this.redis.del(`signup:verify:${dto.verifyToken}`);
    return this.issueTokens(user.id, user.email);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.passwordHash) {
      throw new AppException('INVALID_CREDENTIALS', '이메일 또는 비밀번호가 올바르지 않습니다.', HttpStatus.UNAUTHORIZED);
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new AppException('INVALID_CREDENTIALS', '이메일 또는 비밀번호가 올바르지 않습니다.', HttpStatus.UNAUTHORIZED);
    }
    return this.issueTokens(user.id, user.email);
  }

  async googleAuth(dto: GoogleAuthDto) {
    if (!this.googleClient) {
      throw new AppException('GOOGLE_NOT_CONFIGURED', 'Google OAuth가 설정되지 않았습니다.', HttpStatus.SERVICE_UNAVAILABLE);
    }
    const ticket = await this.googleClient.verifyIdToken({
      idToken: dto.idToken,
      audience: this.configService.get<string>('google.clientId'),
    });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.sub) {
      throw new AppException('INVALID_GOOGLE_TOKEN', 'Google 토큰이 유효하지 않습니다.', HttpStatus.UNAUTHORIZED);
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
        const baseUsername = (payload.name ?? email.split('@')[0])
          .replace(/[^a-zA-Z0-9_]/g, '')
          .slice(0, 40) || `user${sub.slice(0, 8)}`;
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
          return u;
        });
        isNewUser = true;
      }
    }
    const tokens = await this.issueTokens(user.id, user.email);
    return { ...tokens, isNewUser };
  }

  async refresh(refreshToken: string) {
    const userIdStr = await this.redis.get(`refresh:${refreshToken}`);
    if (!userIdStr) {
      throw new AppException('INVALID_REFRESH', '리프레시 토큰이 유효하지 않습니다.', HttpStatus.UNAUTHORIZED);
    }
    const user = await this.prisma.user.findUnique({ where: { id: BigInt(userIdStr) } });
    if (!user) {
      await this.redis.del(`refresh:${refreshToken}`);
      throw new AppException('USER_NOT_FOUND', '사용자를 찾을 수 없습니다.', HttpStatus.NOT_FOUND);
    }
    await this.redis.del(`refresh:${refreshToken}`);
    return this.issueTokens(user.id, user.email);
  }

  async logout(refreshToken: string): Promise<{ loggedOut: boolean }> {
    await this.redis.del(`refresh:${refreshToken}`);
    return { loggedOut: true };
  }

  async passwordResetRequest(email: string): Promise<{ sent: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      this.logger.log(`[password-reset] no local account for ${email}`);
      return { sent: true };
    }
    const tempPassword = randomBytes(9).toString('base64url').slice(0, 12);
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    this.logger.log(`[DEV] Temporary password for ${email}: ${tempPassword}`);
    await this.emailService.sendTempPasswordEmail(email, tempPassword);
    return { sent: true };
  }

  async checkNicknameAvailable(nickname: string): Promise<{ available: boolean }> {
    const taken = await this.prisma.user.findFirst({ where: { nickname } });
    return { available: !taken };
  }

  private async issueTokens(userId: bigint, email: string) {
    const accessSecret = this.configService.get<string>('jwt.accessSecret');
    const accessExpiresIn = this.configService.get<string>('jwt.accessExpiresIn') ?? '30m';

    const accessToken = await this.jwtService.signAsync(
      { sub: userId.toString(), email },
      { secret: accessSecret, expiresIn: accessExpiresIn },
    );

    const refreshToken = randomBytes(48).toString('hex');
    await this.redis.set(`refresh:${refreshToken}`, userId.toString(), REFRESH_TTL_SECONDS);

    return {
      userId: userId.toString(),
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: accessExpiresIn,
    };
  }
}
