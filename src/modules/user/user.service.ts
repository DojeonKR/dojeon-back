import { Injectable, HttpStatus } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { Prisma, ScrapType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import { PatchUserDto } from './dto/patch-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ReauthenticationDto } from './dto/reauthentication.dto';
import { PresignedProfileImageDto } from './dto/presigned-profile-image.dto';
import { LearningService } from '../learning/learning.service';
import { buildS3ObjectPublicUrl } from '../../common/utils/public-asset-url.util';
import { RedisService } from '../../infra/redis/redis.service';
import {
  currentGoalStreakFromDates,
  dateKeyToUtcDate,
  localDateKey,
} from '../../common/utils/local-date.util';

const ACHIEVEMENT_CATEGORY_ORDER = [
  'onboarding',
  'daily_streak',
  'course_completed',
  'lesson_completed',
  'learned',
] as const;

const ACHIEVEMENT_CATEGORY_TITLES: Record<string, string> = {
  onboarding: 'Onboarding',
  daily_streak: 'Daily streak',
  course_completed: 'Course completed',
  lesson_completed: 'Lesson completed',
  learned: 'Learned',
};

@Injectable()
export class UserService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly googleClient: OAuth2Client | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly learningService: LearningService,
    private readonly redis: RedisService,
  ) {
    const region = this.configService.get<string>('aws.region');
    this.bucket = this.configService.get<string>('aws.s3Bucket') ?? '';
    const googleClientId = this.configService.get<string>('google.clientId');
    this.googleClient = googleClientId ? new OAuth2Client(googleClientId) : null;
    this.s3 = new S3Client({
      region,
      credentials:
        this.configService.get('aws.accessKeyId') && this.configService.get('aws.secretAccessKey')
          ? {
              accessKeyId: this.configService.get('aws.accessKeyId')!,
              secretAccessKey: this.configService.get('aws.secretAccessKey')!,
            }
          : undefined,
    });
  }

  async getDashboard(userId: bigint, year?: number, month?: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        nickname: true,
        username: true,
        phoneNumber: true,
        birthday: true,
        profileImgUrl: true,
        motherLanguage: true,
        proficiencyLevel: true,
        ageGroup: true,
        dailyGoalMin: true,
        weeklyGoalMin: true,
        timezone: true,
        learningGoal: true,
        subscriptionTier: true,
        subscriptionPlanId: true,
        subscriptionExpiresAt: true,
        isPushNotificationOn: true,
        isMarketingAgreed: true,
        isOnboarded: true,
        createdAt: true,
        stats: true,
        userBadges: {
          orderBy: { earnedAt: 'desc' },
          take: 4,
          select: {
            badgeId: true,
            earnedAt: true,
            badge: { select: { title: true, imageUrl: true } },
          },
        },
      },
    });
    if (!user) {
      throw new AppException('USER_NOT_FOUND', '사용자를 찾을 수 없습니다.', HttpStatus.NOT_FOUND);
    }

    const now = new Date();
    const todayKey = localDateKey(now, user.timezone);
    const [localYear, localMonth] = todayKey.split('-').map(Number);
    const y = year ?? localYear;
    const mo = month ?? localMonth;

    const start = new Date(Date.UTC(y, mo - 1, 1));
    const end = new Date(Date.UTC(y, mo, 1));
    const todayDate = dateKeyToUtcDate(todayKey);

    const [goalDays, streakDays, savedVocabularyCount, savedGrammarCount, recentCourse] =
      await Promise.all([
        this.prisma.userDailyActivity.findMany({
          where: {
            userId,
            goalAchieved: true,
            activityDate: { gte: start, lt: end },
          },
          orderBy: { activityDate: 'asc' },
          select: { activityDate: true },
        }),
        this.prisma.userDailyActivity.findMany({
          where: { userId, goalAchieved: true, activityDate: { lte: todayDate } },
          orderBy: { activityDate: 'desc' },
          select: { activityDate: true },
          take: 366,
        }),
        this.prisma.scrap.count({
          where: { userId, type: ScrapType.VOCAB, isActive: true },
        }),
        this.prisma.scrap.count({
          where: { userId, type: ScrapType.GRAMMAR, isActive: true },
        }),
        this.learningService.getLastLessonResume(userId),
      ]);

    const activeDays = goalDays.map((activity) => activity.activityDate.getUTCDate());
    const currentStreak = currentGoalStreakFromDates(
      streakDays.map((activity) => activity.activityDate),
      todayKey,
    );

    return {
      profile: {
        userId: user.id.toString(),
        email: user.email,
        hasPassword: user.passwordHash !== null,
        nickname: user.nickname,
        username: user.username,
        phoneNumber: user.phoneNumber,
        birthday: user.birthday,
        profileImgUrl: user.profileImgUrl,
        motherLanguage: user.motherLanguage,
        proficiencyLevel: user.proficiencyLevel,
        ageGroup: user.ageGroup,
        dailyGoalMin: user.dailyGoalMin,
        weeklyGoalMin: user.weeklyGoalMin,
        timezone: user.timezone,
        learningGoal: user.learningGoal,
        subscriptionTier: user.subscriptionTier,
        subscriptionPlanId: user.subscriptionPlanId ?? null,
        subscriptionExpiresAt: user.subscriptionExpiresAt?.toISOString() ?? null,
        isPushNotificationOn: user.isPushNotificationOn,
        isMarketingAgreed: user.isMarketingAgreed,
        isOnboarded: user.isOnboarded,
        createdAt: user.createdAt,
      },
      stats: user.stats
        ? {
            totalStudyMin: user.stats.totalStudyMin,
            currentStreak,
            bestStreak: user.stats.maxStreak,
            totalCompletedLessons: user.stats.totalCompletedLessons,
            savedVocabularyCount,
            savedGrammarCount,
          }
        : null,
      attendance: {
        year: y,
        month: mo,
        activeDays,
      },
      notebookCounts: {
        vocabulary: savedVocabularyCount,
        grammar: savedGrammarCount,
      },
      recentCourse,
      recentAchievements: user.userBadges.map((ub) => ({
        badgeId: ub.badgeId,
        title: ub.badge.title,
        imageUrl: ub.badge.imageUrl,
        earnedAt: ub.earnedAt,
      })),
    };
  }

  async patchMe(userId: bigint, dto: PatchUserDto) {
    const data: Prisma.UserUpdateInput = {};
    if (dto.nickname !== undefined) data.nickname = dto.nickname;
    if (dto.username !== undefined) data.username = dto.username;
    if (dto.phoneNumber !== undefined) data.phoneNumber = dto.phoneNumber;
    if (dto.birthday !== undefined) data.birthday = new Date(dto.birthday);
    if (dto.motherLanguage !== undefined) data.motherLanguage = dto.motherLanguage;
    if (dto.proficiencyLevel !== undefined) data.proficiencyLevel = dto.proficiencyLevel;
    if (dto.ageGroup !== undefined) data.ageGroup = dto.ageGroup;
    if (dto.dailyGoalMin !== undefined) data.dailyGoalMin = dto.dailyGoalMin;
    if (dto.weeklyGoalMin !== undefined) data.weeklyGoalMin = dto.weeklyGoalMin;
    if (dto.timezone !== undefined) data.timezone = dto.timezone;
    if (dto.learningGoal !== undefined) data.learningGoal = dto.learningGoal;
    if (dto.isPushNotificationOn !== undefined)
      data.isPushNotificationOn = dto.isPushNotificationOn;
    if (dto.isMarketingAgreed !== undefined) data.isMarketingAgreed = dto.isMarketingAgreed;
    if (dto.deviceToken !== undefined) data.deviceToken = dto.deviceToken;
    if (dto.profileImgUrl !== undefined) data.profileImgUrl = dto.profileImgUrl;
    if (dto.isOnboarded !== undefined) data.isOnboarded = dto.isOnboarded;

    try {
      await this.prisma.user.update({
        where: { id: userId },
        data,
      });
      return { updated: true };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new AppException(
          'DUPLICATE_ENTRY',
          '이미 사용 중인 닉네임 또는 사용자명입니다.',
          HttpStatus.CONFLICT,
        );
      }
      throw new AppException(
        'UPDATE_FAILED',
        '프로필 수정에 실패했습니다.',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async changePassword(userId: bigint, dto: ChangePasswordDto) {
    await this.assertRecentlyAuthenticated(userId, dto);
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });
    await this.revokeSessions(userId);
    return { updated: true };
  }

  async deleteAccount(userId: bigint, dto: ReauthenticationDto): Promise<{ deleted: boolean }> {
    await this.assertRecentlyAuthenticated(userId, dto);
    await this.revokeSessions(userId);
    await this.prisma.user.delete({ where: { id: userId } });
    return { deleted: true };
  }

  private async assertRecentlyAuthenticated(
    userId: bigint,
    dto: ReauthenticationDto,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        passwordHash: true,
        socialProvider: true,
        socialUid: true,
      },
    });
    const invalid = () =>
      new AppException(
        'REAUTHENTICATION_REQUIRED',
        'Please verify your identity again before this sensitive operation.',
        HttpStatus.UNAUTHORIZED,
      );

    if (!user) throw invalid();

    if (user.passwordHash) {
      if (!dto.currentPassword || !(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
        throw invalid();
      }
      return;
    }

    if (
      user.socialProvider !== 'google' ||
      !user.socialUid ||
      !dto.googleIdToken ||
      !this.googleClient
    ) {
      throw invalid();
    }

    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: dto.googleIdToken,
        audience: this.configService.get<string>('google.clientId'),
      });
      const payload = ticket.getPayload();
      if (!payload || payload.sub !== user.socialUid || payload.email_verified === false) {
        throw invalid();
      }
    } catch {
      throw invalid();
    }
  }

  private async revokeSessions(userId: bigint): Promise<void> {
    const userTokensKey = `user:tokens:${userId}`;
    const activeTokens = await this.redis.sMembers(userTokensKey);
    await this.redis.delMany([
      ...activeTokens.map((token) => `refresh:${token}`),
      userTokensKey,
      `jwt:user:${userId}`,
    ]);
  }

  async getAchievementsList(userId: bigint) {
    const badges = await this.prisma.badge.findMany({
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });
    const earned = await this.prisma.userBadge.findMany({
      where: { userId },
      select: { badgeId: true, earnedAt: true },
    });
    const earnedMap = new Map(earned.map((e) => [e.badgeId, e.earnedAt]));

    const badgesByCategory = new Map<string, typeof badges>();
    for (const badge of badges) {
      const list = badgesByCategory.get(badge.category) ?? [];
      list.push(badge);
      badgesByCategory.set(badge.category, list);
    }

    const categories = ACHIEVEMENT_CATEGORY_ORDER.filter((category) =>
      badgesByCategory.has(category),
    ).map((category) => ({
      category,
      title: ACHIEVEMENT_CATEGORY_TITLES[category] ?? category,
      badges: (badgesByCategory.get(category) ?? []).map((b) => ({
        badgeId: b.id,
        key: b.key,
        title: b.title,
        description: b.description,
        imageUrl: b.imageUrl,
        category: b.category,
        sortOrder: b.sortOrder,
        isEarned: earnedMap.has(b.id),
        earnedAt: earnedMap.get(b.id) ?? null,
      })),
    }));

    const totalEarned = earned.length;

    return { categories, totalEarned };
  }

  async createProfileImagePresignedUrl(userId: bigint, dto: PresignedProfileImageDto) {
    if (!this.bucket) {
      throw new AppException(
        'S3_NOT_CONFIGURED',
        'S3가 설정되지 않았습니다.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const key = `profiles/${userId}/${randomUUID()}.${dto.fileExtension}`;
    const expectedContentType =
      dto.fileExtension === 'png'
        ? 'image/png'
        : dto.fileExtension === 'webp'
          ? 'image/webp'
          : 'image/jpeg';
    if (dto.contentType !== expectedContentType) {
      throw new AppException(
        'INVALID_IMAGE_TYPE',
        'File extension and content type do not match.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: dto.contentType,
      ContentLength: dto.fileSizeBytes,
    });
    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 300 });
    const region = this.configService.get<string>('aws.region') ?? 'ap-northeast-2';
    const fileUrl = buildS3ObjectPublicUrl({
      cloudfrontBaseUrl: this.configService.get<string>('cloudfrontBaseUrl'),
      bucket: this.bucket,
      region,
      key,
    });
    return { uploadUrl, key, fileUrl };
  }
}
