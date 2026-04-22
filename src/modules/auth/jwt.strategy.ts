import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../infra/redis/redis.service';
import { JwtPayloadUser } from '../../common/decorators/current-user.decorator';

const USER_CACHE_TTL = 300; // 5분
const USER_NOT_FOUND_SENTINEL = '__NOT_FOUND__';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.accessSecret'),
    });
  }

  async validate(payload: { sub: string; email: string }): Promise<JwtPayloadUser> {
    const cacheKey = `jwt:user:${payload.sub}`;
    const cached = await this.redis.get(cacheKey);

    if (cached === USER_NOT_FOUND_SENTINEL) {
      throw new UnauthorizedException('유효하지 않은 토큰입니다.');
    }

    if (cached) {
      const parsed = JSON.parse(cached) as { userId: string; email: string };
      return { userId: BigInt(parsed.userId), email: parsed.email };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(payload.sub) },
      select: { id: true, email: true },
    });

    if (!user) {
      await this.redis.set(cacheKey, USER_NOT_FOUND_SENTINEL, USER_CACHE_TTL);
      throw new UnauthorizedException('유효하지 않은 토큰입니다.');
    }

    await this.redis.set(
      cacheKey,
      JSON.stringify({ userId: user.id.toString(), email: user.email }),
      USER_CACHE_TTL,
    );
    return { userId: user.id, email: user.email };
  }
}
