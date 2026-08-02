import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsString, Max, Min } from 'class-validator';

export class PresignedProfileImageDto {
  @ApiProperty({ description: '파일 MIME 타입', example: 'image/jpeg' })
  @IsString()
  @IsIn(['image/jpeg', 'image/png', 'image/webp'])
  contentType!: string;

  @ApiProperty({ description: '파일 확장자', enum: ['jpg', 'jpeg', 'png', 'webp'], example: 'jpg' })
  @IsString()
  @IsIn(['jpg', 'jpeg', 'png', 'webp'])
  fileExtension!: string;

  @ApiProperty({ description: 'Upload size in bytes (maximum 5 MiB)', example: 524288 })
  @IsInt()
  @Min(1)
  @Max(5 * 1024 * 1024)
  fileSizeBytes!: number;
}
