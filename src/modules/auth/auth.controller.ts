import { Body, Controller, Get, Post, Query, UseInterceptors } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { SendEmailCodeDto } from './dto/send-email-code.dto';
import { VerifyEmailCodeDto } from './dto/verify-email-code.dto';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';
import { LogoutDto } from './dto/logout.dto';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('email/send')
  async sendCode(@Body() dto: SendEmailCodeDto) {
    return this.authService.sendEmailCode(dto.email);
  }

  @Public()
  @Post('email/verify')
  async verifyCode(@Body() dto: VerifyEmailCodeDto) {
    return this.authService.verifyEmailCode(dto.email, dto.code);
  }

  @Public()
  @Post('signup')
  @UseInterceptors(IdempotencyInterceptor)
  async signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('google')
  async google(@Body() dto: GoogleAuthDto) {
    return this.authService.googleAuth(dto);
  }

  @Public()
  @Post('reissue')
  async reissue(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  async logout(@Body() dto: LogoutDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @Public()
  @Post('password/reset-request')
  async passwordReset(@Body() dto: PasswordResetRequestDto) {
    return this.authService.passwordResetRequest(dto.email);
  }

  @Public()
  @Get('check-nickname')
  async checkNickname(@Query('nickname') nickname: string) {
    if (!nickname || nickname.length < 1) {
      return { available: false };
    }
    return this.authService.checkNicknameAvailable(nickname);
  }
}
