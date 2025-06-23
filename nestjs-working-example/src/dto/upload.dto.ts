import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsEnum } from 'class-validator';

export class UploadProcessingDto {
  @ApiPropertyOptional({ 
    example: ['resize', 'optimize'], 
    description: 'Image processing operations to apply',
    enum: ['resize', 'optimize', 'grayscale', 'blur', 'sharpen', 'normalize']
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  operations?: string[];

  @ApiPropertyOptional({ enum: ['jpeg', 'png', 'webp'], description: 'Output format for processed image' })
  @IsOptional()
  @IsEnum(['jpeg', 'png', 'webp'])
  format?: 'jpeg' | 'png' | 'webp';

  @ApiPropertyOptional({ example: 80, description: 'Output quality (1-100)' })
  @IsOptional()
  quality?: number;

  @ApiPropertyOptional({ example: true, description: 'Whether to generate thumbnails' })
  @IsOptional()
  generateThumbnails?: boolean;
}
