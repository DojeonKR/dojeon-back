import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ReauthenticationDto {
  @ApiPropertyOptional({
    description: 'Local account current password. Required for password-based accounts.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  currentPassword?: string;

  @ApiPropertyOptional({
    description: 'Fresh Google ID token. Required for Google-only accounts.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  googleIdToken?: string;
}
