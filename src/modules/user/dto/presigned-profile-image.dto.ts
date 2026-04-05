import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MinLength } from 'class-validator';

export class PresignedProfileImageDto {
  @ApiProperty({ description: '파일 MIME 타입', example: 'image/jpeg' })
  @IsString()
  @MinLength(3)
  contentType!: string;

  @ApiProperty({ description: '파일 확장자', enum: ['jpg', 'jpeg', 'png', 'webp'], example: 'jpg' })
  @IsString()
  @IsIn(['jpg', 'jpeg', 'png', 'webp'])
  fileExtension!: string;
}
