import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { StorageDriverName } from '../../config/storage.config';

export class QueryFileDto {
  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Page must be a number' })
  @Min(1, { message: 'Page must be at least 1' })
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 10,
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Limit must be a number' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: 'Limit cannot exceed 100' })
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Filter by MIME type',
    example: 'image/png',
  })
  @IsOptional()
  @IsString({ message: 'mimeType must be a string' })
  mimeType?: string;

  @ApiPropertyOptional({
    description: 'Filter by the backend the file was written to',
    enum: StorageDriverName,
  })
  @IsOptional()
  @IsEnum(StorageDriverName, {
    message: `driver must be one of: ${Object.values(StorageDriverName).join(', ')}`,
  })
  driver?: StorageDriverName;
}
