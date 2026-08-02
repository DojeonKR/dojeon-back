import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayloadUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.accessSecret'),
    });
  }

  async validate(payload: { sub: string; email: string; sv?: number }): Promise<JwtPayloadUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(payload.sub) },
      select: { id: true, email: true, sessionVersion: true },
    });

    if (!user) {
      throw new UnauthorizedException('유효하지 않은 토큰입니다.');
    }

    if ((payload.sv ?? 0) !== user.sessionVersion) {
      throw new UnauthorizedException('Session has been revoked.');
    }

    return { userId: user.id, email: user.email };
  }
}
