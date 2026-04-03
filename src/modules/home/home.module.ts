import { Module } from '@nestjs/common';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';
import { LearningModule } from '../learning/learning.module';

@Module({
  imports: [LearningModule],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
