import { Body, Controller, Get, Post, Query, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
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
import { PasswordResetConfirmDto } from './dto/password-reset-confirm.dto';
import { successExample, errorExample } from '../../common/swagger/swagger-response.helper';

@ApiTags('인증 (Auth)')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({
    summary: '이메일 인증 코드 발송',
    description:
      '입력한 이메일로 6자리 인증 코드를 발송합니다. 실제 메일은 AWS SES 또는 SMTP(SMTP_HOST 등, Gmail은 앱 비밀번호) 설정 시 발송됩니다. NODE_ENV=production 인데 둘 다 없으면 503입니다. 개발 모드에서는 메일 대신 서버 로그에 코드가 남습니다.',
  })
  @ApiResponse({
    status: 200,
    description: '인증 코드 발송 처리 완료 (개발 모드는 로그에만 있을 수 있음)',
    schema: { example: successExample({ sent: true }) },
  })
  @ApiResponse({
    status: 503,
    description: '운영 환경에서 이메일(SES/SMTP) 미설정',
    schema: { example: errorExample('이메일 발송이 설정되지 않았습니다.', 503, 'EMAIL_NOT_CONFIGURED') },
  })
  @ApiResponse({
    status: 429,
    description: 'OTP 재요청 쿨다운(60초) 또는 전역/라우트별 요청 제한',
    schema: { example: errorExample('인증 코드는 60초에 한 번만 요청할 수 있습니다.', 429, 'OTP_COOLDOWN') },
  })
  @ApiResponse({
    status: 502,
    description: 'SES/SMTP 호출 실패',
    schema: { example: errorExample('이메일 발송에 실패했습니다. SES 발신 검증·IAM 권한·SMTP 설정을 확인하거나 잠시 후 다시 시도하세요.', 502, 'EMAIL_SEND_FAILED') },
  })
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('email/send')
  async sendCode(@Body() dto: SendEmailCodeDto) {
    return this.authService.sendEmailCode(dto.email);
  }

  @ApiOperation({ summary: '이메일 인증 코드 확인', description: '발송된 6자리 코드를 검증하고 verifyToken을 반환합니다.' })
  @ApiResponse({
    status: 200,
    description: '인증 성공 — verifyToken만 반환(회원가입 시 동일 본문에 사용)',
    schema: { example: successExample({ verifyToken: 'a3f9c2e1...' }) },
  })
  @ApiResponse({ status: 400, description: '코드 불일치 또는 만료', schema: { example: errorExample('인증 코드가 올바르지 않거나 만료되었습니다.', 400, 'INVALID_CODE') } })
  @ApiResponse({
    status: 429,
    description: '연속 오답 횟수 초과 — OTP 무효화, 코드 재발송 필요',
    schema: { example: errorExample('인증 시도 횟수를 초과했습니다. 코드를 다시 요청하세요.', 429, 'OTP_ATTEMPTS_EXCEEDED') },
  })
  @Public()
  @Throttle({ default: { limit: 25, ttl: 60000 } })
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
  @ApiResponse({
    status: 400,
    description: '약관 미동의',
    schema: { example: errorExample('필수 약관에 동의해야 가입할 수 있습니다.', 400, 'TERMS_NOT_AGREED') },
  })
  @ApiResponse({
    status: 400,
    description: 'verifyToken 불일치·만료(이메일 인증 미완료)',
    schema: { example: errorExample('이메일 인증이 완료되지 않았거나 토큰이 만료되었습니다.', 400, 'INVALID_VERIFY_TOKEN') },
  })
  @ApiResponse({
    status: 409,
    description: 'Idempotency-Key 동일·본문 상이',
    schema: { example: errorExample('Idempotency-Key가 동일하지만 요청 본문이 다릅니다.', 409, '409') },
  })
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
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
        tokenType: 'Bearer',
        expiresIn: '30m',
      }),
    },
  })
  @ApiResponse({ status: 401, description: '이메일 또는 비밀번호 불일치', schema: { example: errorExample('이메일 또는 비밀번호가 올바르지 않습니다.', 401, 'INVALID_CREDENTIALS') } })
  @Public()
  @Throttle({ default: { limit: 15, ttl: 60000 } })
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
        tokenType: 'Bearer',
        expiresIn: '30m',
        isNewUser: false,
      }),
    },
  })
  @ApiResponse({
    status: 503,
    description: 'GOOGLE_CLIENT_ID 미설정',
    schema: { example: errorExample('Google OAuth가 설정되지 않았습니다.', 503, 'GOOGLE_NOT_CONFIGURED') },
  })
  @ApiResponse({
    status: 401,
    description: 'ID 토큰 검증 실패',
    schema: { example: errorExample('Google 토큰이 유효하지 않습니다.', 401, 'INVALID_GOOGLE_TOKEN') },
  })
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
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
        userId: '1',
        accessToken: 'eyJhb...',
        refreshToken: 'eyJhb...',
        tokenType: 'Bearer',
        expiresIn: '30m',
      }),
    },
  })
  @ApiResponse({ status: 401, description: '유효하지 않은 리프레시 토큰', schema: { example: errorExample('리프레시 토큰이 유효하지 않습니다.', 401, 'INVALID_TOKEN') } })
  @ApiResponse({
    status: 404,
    description: '리프레시는 유효했으나 사용자 레코드 없음(토큰 정리 후 발생 가능)',
    schema: { example: errorExample('사용자를 찾을 수 없습니다.', 404, 'USER_NOT_FOUND') },
  })
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
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
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Post('logout')
  async logout(@Body() dto: LogoutDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @ApiOperation({
    summary: '비밀번호 재설정 요청',
    description: '이메일로 6자리 인증 코드를 발송합니다. 이후 `POST /auth/password/reset-confirm`으로 새 비밀번호를 설정하세요.',
  })
  @ApiResponse({
    status: 200,
    description: '인증 코드 발송 완료',
    schema: { example: successExample({ sent: true }) },
  })
  @ApiResponse({
    status: 429,
    description: 'OTP 쿨다운 또는 레이트 리밋',
    schema: { example: errorExample('인증 코드는 60초에 한 번만 요청할 수 있습니다.', 429, 'OTP_COOLDOWN') },
  })
  @ApiResponse({
    status: 502,
    description: '메일 발송 실패',
    schema: { example: errorExample('이메일 발송에 실패했습니다. SES 발신 검증·IAM 권한·SMTP 설정을 확인하거나 잠시 후 다시 시도하세요.', 502, 'EMAIL_SEND_FAILED') },
  })
  @ApiResponse({
    status: 503,
    description: 'production에서 SES/SMTP 미설정',
    schema: { example: errorExample('이메일 발송이 설정되지 않았습니다. AWS SES 또는 SMTP(SMTP_HOST 등)를 구성하세요.', 503, 'EMAIL_NOT_CONFIGURED') },
  })
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('password/reset-request')
  async passwordReset(@Body() dto: PasswordResetRequestDto) {
    return this.authService.passwordResetRequest(dto.email);
  }

  @ApiOperation({
    summary: '비밀번호 재설정 확정',
    description: '이메일로 받은 OTP와 새 비밀번호로 계정 비밀번호를 변경합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '비밀번호 변경 완료',
    schema: { example: successExample({ reset: true }) },
  })
  @ApiResponse({
    status: 400,
    description: 'OTP 불일치·만료',
    schema: { example: errorExample('인증 코드가 올바르지 않거나 만료되었습니다.', 400, 'INVALID_CODE') },
  })
  @ApiResponse({
    status: 429,
    description: '연속 오답으로 OTP 무효화',
    schema: { example: errorExample('인증 시도 횟수를 초과했습니다. 코드를 다시 요청하세요.', 429, 'OTP_ATTEMPTS_EXCEEDED') },
  })
  @ApiResponse({
    status: 404,
    description: '이메일에 해당하는 로컬 비밀번호 계정 없음',
    schema: { example: errorExample('사용자를 찾을 수 없습니다.', 404, 'USER_NOT_FOUND') },
  })
  @Public()
  @Throttle({ default: { limit: 25, ttl: 60000 } })
  @Post('password/reset-confirm')
  async passwordResetConfirm(@Body() dto: PasswordResetConfirmDto) {
    return this.authService.passwordResetConfirm(dto);
  }

  @ApiOperation({ summary: '닉네임 중복 확인', description: '닉네임 사용 가능 여부를 반환합니다.' })
  @ApiQuery({ name: 'nickname', description: '확인할 닉네임', example: '도전이' })
  @ApiResponse({
    status: 200,
    description: '중복 확인 결과',
    schema: { example: successExample({ available: true }) },
  })
  @Public()
  @Throttle({ default: { limit: 40, ttl: 60000 } })
  @Get('check-nickname')
  async checkNickname(@Query('nickname') nickname: string) {
    if (!nickname || nickname.length < 1) {
      return { available: false };
    }
    return this.authService.checkNicknameAvailable(nickname);
  }
}
