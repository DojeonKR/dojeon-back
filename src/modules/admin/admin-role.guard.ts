import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayloadUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class AdminRoleGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ user?: JwtPayloadUser }>();
    const user = req.user;
    if (!user) {
      throw new ForbiddenException('관리자 권한이 필요합니다.');
    }
    const row = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { role: true },
    });
    if (row?.role !== 'admin') {
      throw new ForbiddenException('관리자 권한이 필요합니다.');
    }
    return true;
  }
}
