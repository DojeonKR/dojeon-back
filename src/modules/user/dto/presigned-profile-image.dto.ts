import { IsIn, IsString, MinLength } from 'class-validator';

export class PresignedProfileImageDto {
  @IsString()
  @MinLength(3)
  contentType!: string;

  @IsString()
  @IsIn(['jpg', 'jpeg', 'png', 'webp'])
  fileExtension!: string;
}
