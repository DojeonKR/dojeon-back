import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminRoleGuard } from './admin-role.guard';
import { PrismaModule } from '../../prisma/prisma.module';
import { AchievementModule } from '../achievement/achievement.module';

@Module({
  imports: [PrismaModule, AchievementModule],
  controllers: [AdminController],
  providers: [AdminService, AdminRoleGuard],
})
export class AdminModule {}
