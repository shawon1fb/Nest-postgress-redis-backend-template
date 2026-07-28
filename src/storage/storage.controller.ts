import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FastifyReply, FastifyRequest } from 'fastify';
import { StorageService } from './storage.service';
import { FileResponseDto, FileUrlResponseDto, QueryFileDto } from './dto';
import { MessageResponseDto } from '../common/dto';
import {
  ApiEnvelopeResponse,
  ApiEnvelopePaginatedResponse,
  ApiEnvelopeMessageResponse,
  ApiErrorResponse,
  SkipTransform,
} from '../common/decorators';
import { PaginatedResponseDto } from '../common/dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser, Roles } from '../auth/decorators';
import { UserRole } from '../database/schema';
import { UserResponseDto } from '../users/dto';

const UNAUTHORIZED = {
  status: 401,
  description: 'Unauthorized - Invalid or missing authentication',
  message: 'Unauthorized',
};
const NOT_FOUND = {
  status: 404,
  description: 'File not found',
  message: 'File not found',
};

@ApiTags('Storage')
@ApiBearerAuth()
@Controller('files')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload')
  @ApiOperation({
    summary: 'Upload a file',
    description:
      'Stores a file in the backend selected by STORAGE_DRIVER and records its metadata.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiEnvelopeResponse(FileResponseDto, {
    status: 201,
    description: 'File uploaded successfully',
  })
  @ApiErrorResponse({
    status: 400,
    description: 'No file part in the request, or the file is empty',
    message: 'No file was uploaded',
  })
  @ApiErrorResponse(UNAUTHORIZED)
  @ApiErrorResponse({
    status: 413,
    description: 'File exceeds STORAGE_MAX_FILE_SIZE',
    message: 'File exceeds the maximum allowed size of 10485760 bytes',
  })
  @ApiErrorResponse({
    status: 415,
    description: 'MIME type not in STORAGE_ALLOWED_MIME_TYPES',
    message: 'MIME type application/x-msdownload is not allowed',
  })
  async upload(
    @Req() request: FastifyRequest,
    @CurrentUser() user: UserResponseDto,
  ): Promise<FileResponseDto> {
    if (!request.isMultipart()) {
      throw new BadRequestException(
        'Request must be multipart/form-data with a "file" part',
      );
    }

    const upload = await request.file();
    if (!upload) {
      throw new BadRequestException('No file was uploaded');
    }

    const buffer = await upload.toBuffer();

    return this.storageService.upload({
      buffer,
      originalName: upload.filename,
      mimeType: upload.mimetype,
      uploadedBy: user?.id,
    });
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiOperation({
    summary: 'List files',
    description:
      'Returns a paginated list of stored file metadata. Admin or Moderator access required.',
  })
  @ApiEnvelopePaginatedResponse(FileResponseDto, {
    status: 200,
    description: 'Files retrieved successfully',
  })
  @ApiErrorResponse(UNAUTHORIZED)
  @ApiErrorResponse({
    status: 403,
    description: 'Forbidden - Admin or Moderator access required',
    message: 'Forbidden resource',
  })
  async findAll(
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    queryDto: QueryFileDto,
  ): Promise<PaginatedResponseDto<FileResponseDto>> {
    return this.storageService.findAll(queryDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get file metadata',
    description: 'Returns the stored metadata for a file, without its bytes.',
  })
  @ApiParam({ name: 'id', description: 'File UUID', format: 'uuid' })
  @ApiEnvelopeResponse(FileResponseDto, {
    status: 200,
    description: 'File metadata retrieved successfully',
  })
  @ApiErrorResponse(UNAUTHORIZED)
  @ApiErrorResponse(NOT_FOUND)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FileResponseDto> {
    return this.storageService.findOne(id);
  }

  @Get(':id/url')
  @ApiOperation({
    summary: 'Get a fetchable URL for a file',
    description:
      'Returns a signed, time-limited URL on backends that support it (s3, appwrite), or a public URL on the local driver.',
  })
  @ApiParam({ name: 'id', description: 'File UUID', format: 'uuid' })
  @ApiQuery({
    name: 'expiresIn',
    required: false,
    type: Number,
    description:
      'Seconds the URL stays valid. Defaults to STORAGE_URL_EXPIRES_IN.',
  })
  @ApiEnvelopeResponse(FileUrlResponseDto, {
    status: 200,
    description: 'URL generated successfully',
  })
  @ApiErrorResponse(UNAUTHORIZED)
  @ApiErrorResponse(NOT_FOUND)
  @ApiErrorResponse({
    status: 500,
    description:
      'The active driver cannot build a URL (e.g. STORAGE_LOCAL_BASE_URL unset)',
    message: 'Internal server error',
  })
  async getUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('expiresIn') expiresIn?: string,
  ): Promise<FileUrlResponseDto> {
    const ttl = expiresIn === undefined ? undefined : Number(expiresIn);

    if (ttl !== undefined && (!Number.isFinite(ttl) || ttl <= 0)) {
      throw new BadRequestException('expiresIn must be a positive number');
    }
    return this.storageService.getUrl(id, ttl);
  }

  @Get(':id/download')
  @SkipTransform()
  @ApiOperation({
    summary: 'Download file contents',
    description:
      'Streams the raw bytes. This route is not wrapped in the response envelope.',
  })
  @ApiParam({ name: 'id', description: 'File UUID', format: 'uuid' })
  // Content type is declared on this response only — @ApiProduces would apply
  // it to the error responses too, hiding their JSON schema.
  @ApiResponse({
    status: 200,
    description: 'Raw file contents',
    content: {
      'application/octet-stream': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiErrorResponse(UNAUTHORIZED)
  @ApiErrorResponse(NOT_FOUND)
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const { stream, record } = await this.storageService.download(id);

    await reply
      .header('Content-Type', record.mimeType)
      .header('Content-Length', record.size)
      .header(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(record.originalName)}"`,
      )
      .send(stream);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Delete a file',
    description:
      'Removes the object from the storage backend and its metadata row. Admin access required.',
  })
  @ApiParam({ name: 'id', description: 'File UUID', format: 'uuid' })
  @ApiEnvelopeMessageResponse({
    status: 200,
    description: 'File deleted successfully',
    message: 'File deleted successfully',
  })
  @ApiErrorResponse(UNAUTHORIZED)
  @ApiErrorResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
    message: 'Forbidden resource',
  })
  @ApiErrorResponse(NOT_FOUND)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MessageResponseDto> {
    return this.storageService.remove(id);
  }
}
