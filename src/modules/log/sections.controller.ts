import { Body, Controller, Get, Param, ParseIntPipe, Post, UseInterceptors } from '@nestjs/common';
import { LogService } from './log.service';
import { CurrentUser, JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { SectionProgressDto } from './dto/section-progress.dto';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';

@Controller('section')
export class SectionsController {
  constructor(private readonly logService: LogService) {}

  @Get(':sectionId/material')
  async materials(@Param('sectionId', ParseIntPipe) sectionId: number) {
    return this.logService.getSectionMaterialsList(sectionId);
  }

  @Get(':sectionId/card')
  async cards(@Param('sectionId', ParseIntPipe) sectionId: number) {
    return this.logService.getSectionCardsList(sectionId);
  }

  @Get(':sectionId/question')
  async questions(@Param('sectionId', ParseIntPipe) sectionId: number) {
    return this.logService.getSectionQuestionsList(sectionId);
  }

  @Post(':sectionId/progress')
  @UseInterceptors(IdempotencyInterceptor)
  async progress(
    @CurrentUser() user: JwtPayloadUser,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Body() dto: SectionProgressDto,
  ) {
    return this.logService.saveSectionProgress(user.userId, sectionId, dto);
  }
}
