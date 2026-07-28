import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StorageDriverName } from '../../config/storage.config';

export class FileResponseDto {
  @ApiProperty({
    description: 'Unique file identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description: 'Driver-agnostic storage key',
    example: 'uploads/2026/07/6f1b2c3d-4e5f-6789-abcd-ef0123456789.png',
  })
  key: string;

  @ApiProperty({
    description: 'Backend the bytes were written to',
    enum: StorageDriverName,
    example: StorageDriverName.LOCAL,
  })
  driver: StorageDriverName;

  @ApiProperty({
    description: 'File name as supplied by the client',
    example: 'avatar.png',
  })
  originalName: string;

  @ApiProperty({
    description: 'Detected MIME type',
    example: 'image/png',
  })
  mimeType: string;

  @ApiProperty({
    description: 'Size in bytes',
    example: 20481,
  })
  size: number;

  @ApiPropertyOptional({
    description: 'SHA-256 checksum of the stored bytes',
    example: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    nullable: true,
  })
  checksum?: string | null;

  @ApiPropertyOptional({
    description: 'User who uploaded the file',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
    nullable: true,
  })
  uploadedBy?: string | null;

  @ApiPropertyOptional({
    description: 'Arbitrary key/value metadata stored alongside the file',
    example: { purpose: 'avatar' },
    nullable: true,
  })
  metadata?: Record<string, string> | null;

  @ApiProperty({
    description: 'Upload timestamp',
    example: '2026-07-28T10:30:00.000Z',
    format: 'date-time',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2026-07-28T10:30:00.000Z',
    format: 'date-time',
  })
  updatedAt: Date;
}

export class FileUrlResponseDto {
  @ApiProperty({
    description:
      'URL the file can be fetched from. Signed and time-limited on backends that support it.',
    example: 'https://cdn.example.com/uploads/2026/07/avatar.png',
  })
  url: string;

  @ApiProperty({
    description: 'Seconds until the URL expires (0 when it does not expire)',
    example: 900,
  })
  expiresIn: number;
}
