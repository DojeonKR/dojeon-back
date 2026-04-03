import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ScrapType } from '@prisma/client';
import { LogService } from './log.service';
import { CurrentUser, JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { CreateScrapDto } from './dto/create-scrap.dto';
import { AppException } from '../../common/exceptions/app.exception';
import { HttpStatus } from '@nestjs/common';

@Controller('scrap')
export class ScrapsController {
  constructor(private readonly logService: LogService) {}

  @Get('dashboard')
  async dashboard(@CurrentUser() user: JwtPayloadUser) {
    return this.logService.getScrapsDashboard(user.userId);
  }

  @Get()
  async list(
    @CurrentUser() user: JwtPayloadUser,
    @Query('type') type: string,
    @Query('sort') sort?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limitStr?: string,
  ) {
    if (!type || (type !== 'VOCAB' && type !== 'GRAMMAR')) {
      throw new AppException('INVALID_QUERY', 'type은 VOCAB 또는 GRAMMAR 여야 합니다.', HttpStatus.BAD_REQUEST);
    }
    const limit = limitStr ? Math.min(Math.max(parseInt(limitStr, 10) || 20, 1), 100) : 20;
    return this.logService.listScraps(user.userId, type as ScrapType, sort ?? 'recent', cursor, limit);
  }

  @Post()
  async create(@CurrentUser() user: JwtPayloadUser, @Body() dto: CreateScrapDto) {
    return this.logService.createScrap(user.userId, dto);
  }

  @Delete(':scrapId')
  async remove(@CurrentUser() user: JwtPayloadUser, @Param('scrapId') scrapId: string) {
    return this.logService.deleteScrap(user.userId, BigInt(scrapId));
  }
}
