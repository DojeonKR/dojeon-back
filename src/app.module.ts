import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './infra/redis/redis.module';
import { SqsModule } from './infra/sqs/sqs.module';
import { EmailModule } from './infra/email/email.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard';
import { UserModule } from './modules/user/user.module';
import { AchievementModule } from './modules/achievement/achievement.module';
import { LearningModule } from './modules/learning/learning.module';
import { LogModule } from './modules/log/log.module';
import { NlpModule } from './modules/nlp/nlp.module';
import { HomeModule } from './modules/home/home.module';
import { PracticeModule } from './modules/practice/practice.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    PrismaModule,
    RedisModule,
    SqsModule,
    EmailModule,
    AuthModule,
    UserModule,
    AchievementModule,
    LearningModule,
    HomeModule,
    PracticeModule,
    SubscriptionModule,
    LogModule,
    NlpModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
