import { Injectable, HttpStatus } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import { PatchUserDto } from './dto/patch-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { PresignedProfileImageDto } from './dto/presigned-profile-image.dto';
import { LearningService } from '../learning/learning.service';

@Injectable()
export class UserService {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly learningService: LearningService,
  ) {
    const region = this.configService.get<string>('aws.region');
    this.bucket = this.configService.get<string>('aws.s3Bucket') ?? '';
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
      include: {
        stats: true,
        userBadges: {
          orderBy: { earnedAt: 'desc' },
          include: { badge: true },
        },
      },
    });
    if (!user) {
      throw new AppException('USER_NOT_FOUND', '사용자를 찾을 수 없습니다.', HttpStatus.NOT_FOUND);
    }

    const now = new Date();
    const y = year ?? now.getUTCFullYear();
    const mo = month ?? now.getUTCMonth() + 1;

    const start = new Date(Date.UTC(y, mo - 1, 1));
    const end = new Date(Date.UTC(y, mo, 0));

    const attendances = await this.prisma.userAttendance.findMany({
      where: {
        userId,
        attendanceDate: { gte: start, lte: end },
      },
      orderBy: { attendanceDate: 'asc' },
    });

    const activeDays = attendances.map((a) => a.attendanceDate.getUTCDate());

    const recentCourse = await this.learningService.getLastLessonResume(userId);

    return {
      profile: {
        userId: user.id.toString(),
        email: user.email,
        nickname: user.nickname,
        username: user.username,
        phoneNumber: user.phoneNumber,
        birthday: user.birthday,
        profileImgUrl: user.profileImgUrl,
        motherLanguage: user.motherLanguage,
        proficiencyLevel: user.proficiencyLevel,
        ageGroup: user.ageGroup,
        dailyGoalMin: user.dailyGoalMin,
        learningGoal: user.learningGoal,
        subscriptionTier: user.subscriptionTier,
        subscriptionPlanId: user.subscriptionPlanId ?? null,
        subscriptionExpiresAt: user.subscriptionExpiresAt?.toISOString() ?? null,
        isPushNotificationOn: user.isPushNotificationOn,
        isMarketingAgreed: user.isMarketingAgreed,
        createdAt: user.createdAt,
      },
      stats: user.stats
        ? {
            totalStudyMin: user.stats.totalStudyMin,
            currentStreak: user.stats.currentStreak,
            bestStreak: user.stats.maxStreak,
            totalCompletedLessons: user.stats.totalCompletedLessons,
          }
        : null,
      attendance: {
        year: y,
        month: mo,
        activeDays,
      },
      recentCourse,
      recentAchievements: user.userBadges.slice(0, 4).map((ub) => ({
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
    if (dto.learningGoal !== undefined) data.learningGoal = dto.learningGoal;
    if (dto.isPushNotificationOn !== undefined) data.isPushNotificationOn = dto.isPushNotificationOn;
    if (dto.isMarketingAgreed !== undefined) data.isMarketingAgreed = dto.isMarketingAgreed;
    if (dto.deviceToken !== undefined) data.deviceToken = dto.deviceToken;
    if (dto.profileImgUrl !== undefined) data.profileImgUrl = dto.profileImgUrl;

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
      throw new AppException('UPDATE_FAILED', '프로필 수정에 실패했습니다.', HttpStatus.BAD_REQUEST);
    }
  }

  async changePassword(userId: bigint, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash) {
      throw new AppException(
        'PASSWORD_NOT_SET',
        '소셜 로그인 계정은 비밀번호가 없습니다.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) {
      throw new AppException(
        'INVALID_CURRENT_PASSWORD',
        '현재 비밀번호가 올바르지 않습니다.',
        HttpStatus.UNAUTHORIZED,
      );
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    return { updated: true };
  }

  async getAchievementsList(userId: bigint) {
    const badges = await this.prisma.badge.findMany({ orderBy: { id: 'asc' } });
    const earned = await this.prisma.userBadge.findMany({
      where: { userId },
      select: { badgeId: true, earnedAt: true },
    });
    const earnedMap = new Map(earned.map((e) => [e.badgeId, e.earnedAt]));

    const badgesList = badges.map((b) => ({
      badgeId: b.id,
      title: b.title,
      description: b.description,
      imageUrl: b.imageUrl,
      isEarned: earnedMap.has(b.id),
      earnedAt: earnedMap.get(b.id) ?? null,
    }));

    const totalEarned = earned.length;

    return { badges: badgesList, totalEarned };
  }

  async createProfileImagePresignedUrl(userId: bigint, dto: PresignedProfileImageDto) {
    if (!this.bucket) {
      throw new AppException('S3_NOT_CONFIGURED', 'S3가 설정되지 않았습니다.', HttpStatus.SERVICE_UNAVAILABLE);
    }
    const key = `profiles/${userId}/${randomUUID()}.${dto.fileExtension}`;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: dto.contentType,
    });
    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 3600 });
    const fileUrl = `https://${this.bucket}.s3.${this.configService.get('aws.region')}.amazonaws.com/${key}`;
    return { uploadUrl, key, fileUrl };
  }
}
