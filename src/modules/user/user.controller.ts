import { Body, Controller, Get, Patch, Post, Query } from '@nestjs/common';
import { UserService } from './user.service';
import { CurrentUser, JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { PatchUserDto } from './dto/patch-user.dto';
import { PresignedProfileImageDto } from './dto/presigned-profile-image.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  async getMe(
    @CurrentUser() user: JwtPayloadUser,
    @Query('year') yearStr?: string,
    @Query('month') monthStr?: string,
  ) {
    const year = yearStr ? parseInt(yearStr, 10) : undefined;
    const month = monthStr ? parseInt(monthStr, 10) : undefined;
    return this.userService.getDashboard(user.userId, year, month);
  }

  @Patch('me')
  async patchMe(@CurrentUser() user: JwtPayloadUser, @Body() dto: PatchUserDto) {
    return this.userService.patchMe(user.userId, dto);
  }

  @Get('me/achievement')
  async getAchievements(@CurrentUser() user: JwtPayloadUser) {
    return this.userService.getAchievementsList(user.userId);
  }

  @Post('me/profileImage/presignedUrl')
  async presignedProfileImage(
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: PresignedProfileImageDto,
  ) {
    return this.userService.createProfileImagePresignedUrl(user.userId, dto);
  }
}
