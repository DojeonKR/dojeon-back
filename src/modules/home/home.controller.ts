import { Controller, Get } from '@nestjs/common';
import { HomeService } from './home.service';
import { CurrentUser, JwtPayloadUser } from '../../common/decorators/current-user.decorator';

@Controller('home')
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  @Get('resume')
  async resume(@CurrentUser() user: JwtPayloadUser) {
    return this.homeService.getResume(user.userId);
  }
}
