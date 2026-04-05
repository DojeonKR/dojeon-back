import { Body, Controller, Get, Post, Query, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
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
import { successExample, errorExample } from '../../common/swagger/swagger-response.helper';

@ApiTags('인증 (Auth)')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: '이메일 인증 코드 발송', description: '입력한 이메일로 6자리 인증 코드를 발송합니다.' })
  @ApiResponse({
    status: 200,
    description: '인증 코드 발송 성공',
    schema: { example: successExample({ sent: true }) },
  })
  @Public()
  @Post('email/send')
  async sendCode(@Body() dto: SendEmailCodeDto) {
    return this.authService.sendEmailCode(dto.email);
  }

  @ApiOperation({ summary: '이메일 인증 코드 확인', description: '발송된 6자리 코드를 검증하고 verifyToken을 반환합니다.' })
  @ApiResponse({
    status: 200,
    description: '인증 성공 — verifyToken 반환',
    schema: { example: successExample({ verified: true, verifyToken: 'eyJhb...' }) },
  })
  @ApiResponse({ status: 400, description: '코드 불일치 또는 만료', schema: { example: errorExample('인증 코드가 올바르지 않거나 만료되었습니다.', 400, 'INVALID_CODE') } })
  @Public()
  @Post('email/verify')
  async verifyCode(@Body() dto: VerifyEmailCodeDto) {
    return this.authService.verifyEmailCode(dto.email, dto.code);
  }

  @ApiOperation({
    summary: '회원가입',
    description: 'verifyToken + 이메일 + 비밀번호로 계정을 생성합니다. 닉네임은 온보딩 첫 화면에서 `PATCH /user/me`로 설정합니다. (Idempotency-Key 헤더 권장)',
  })
  @ApiResponse({
    status: 200,
    description: '회원가입 성공 — JWT 토큰 반환',
    schema: {
      example: successExample({
        userId: '1',
        accessToken: 'eyJhb...',
        refreshToken: 'eyJhb...',
        tokenType: 'Bearer',
        expiresIn: '30m',
      }),
    },
  })
  @ApiResponse({ status: 409, description: '이미 가입된 이메일', schema: { example: errorExample('이미 가입된 이메일입니다.', 409, 'EMAIL_EXISTS') } })
  @Public()
  @Post('signup')
  @UseInterceptors(IdempotencyInterceptor)
  async signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @ApiOperation({ summary: '이메일 로그인', description: '이메일/비밀번호로 로그인하고 JWT 토큰을 반환합니다.' })
  @ApiResponse({
    status: 200,
    description: '로그인 성공',
    schema: {
      example: successExample({
        userId: '1',
        accessToken: 'eyJhb...',
        refreshToken: 'eyJhb...',
      }),
    },
  })
  @ApiResponse({ status: 401, description: '이메일 또는 비밀번호 불일치', schema: { example: errorExample('이메일 또는 비밀번호가 올바르지 않습니다.', 401, 'INVALID_CREDENTIALS') } })
  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @ApiOperation({ summary: '구글 소셜 로그인', description: 'Google ID Token으로 로그인 또는 자동 회원가입을 처리합니다.' })
  @ApiResponse({
    status: 200,
    description: '구글 로그인 성공',
    schema: {
      example: successExample({
        userId: '1',
        accessToken: 'eyJhb...',
        refreshToken: 'eyJhb...',
        isNewUser: false,
      }),
    },
  })
  @Public()
  @Post('google')
  async google(@Body() dto: GoogleAuthDto) {
    return this.authService.googleAuth(dto);
  }

  @ApiOperation({ summary: '액세스 토큰 재발급', description: '유효한 리프레시 토큰으로 새 액세스 토큰을 발급합니다.' })
  @ApiResponse({
    status: 200,
    description: '토큰 재발급 성공',
    schema: {
      example: successExample({
        accessToken: 'eyJhb...',
        refreshToken: 'eyJhb...',
      }),
    },
  })
  @ApiResponse({ status: 401, description: '유효하지 않은 리프레시 토큰', schema: { example: errorExample('리프레시 토큰이 유효하지 않습니다.', 401, 'INVALID_TOKEN') } })
  @Public()
  @Post('reissue')
  async reissue(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @ApiOperation({ summary: '로그아웃', description: '서버에 저장된 리프레시 토큰을 무효화합니다.' })
  @ApiResponse({
    status: 200,
    description: '로그아웃 성공',
    schema: { example: successExample({ loggedOut: true }) },
  })
  @Public()
  @Post('logout')
  async logout(@Body() dto: LogoutDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @ApiOperation({ summary: '비밀번호 재설정 요청', description: '이메일로 임시 비밀번호를 발송합니다.' })
  @ApiResponse({
    status: 200,
    description: '임시 비밀번호 발송 완료',
    schema: { example: successExample({ sent: true }) },
  })
  @Public()
  @Post('password/reset-request')
  async passwordReset(@Body() dto: PasswordResetRequestDto) {
    return this.authService.passwordResetRequest(dto.email);
  }

  @ApiOperation({ summary: '닉네임 중복 확인', description: '닉네임 사용 가능 여부를 반환합니다.' })
  @ApiQuery({ name: 'nickname', description: '확인할 닉네임', example: '도전이' })
  @ApiResponse({
    status: 200,
    description: '중복 확인 결과',
    schema: { example: successExample({ available: true }) },
  })
  @Public()
  @Get('check-nickname')
  async checkNickname(@Query('nickname') nickname: string) {
    if (!nickname || nickname.length < 1) {
      return { available: false };
    }
    return this.authService.checkNicknameAvailable(nickname);
  }
}
