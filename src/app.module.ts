import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bullmq';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './infra/redis/redis.module';
import { RedisService } from './infra/redis/redis.service';
import { RedisThrottlerStorageService } from './infra/throttler/redis-throttler.storage';
import { EmailModule } from './infra/email/email.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard';
import { UserModule } from './modules/user/user.module';
import { AchievementModule } from './modules/achievement/achievement.module';
import { LearningModule } from './modules/learning/learning.module';
import { LogModule } from './modules/log/log.module';
import { HomeModule } from './modules/home/home.module';
import { PracticeModule } from './modules/practice/practice.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { HealthController } from './health.controller';
import { AdminModule } from './modules/admin/admin.module';
import { SqsModule } from './infra/sqs/sqs.module';
import { NlpModule } from './modules/nlp/nlp.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    EventEmitterModule.forRoot(),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>('redisUrl') ?? 'redis://localhost:6379',
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisService],
      useFactory: (redis: RedisService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: 60000,
            limit: 120,
          },
        ],
        storage: new RedisThrottlerStorageService(redis.getClient(), false),
      }),
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
    AdminModule,
    NlpModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
