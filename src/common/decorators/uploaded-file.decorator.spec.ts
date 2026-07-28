import { Controller, Module, Post } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import multipart from '@fastify/multipart';
import { IsNotEmpty, IsString } from 'class-validator';
import { GlobalExceptionFilter } from '../filters';
import { TransformInterceptor } from '../interceptors';
import { StorageMessage } from '../i18n';
import { UploadedFileData } from '../multipart';
import {
  MultipartBody,
  UploadedFile,
  UploadedFiles,
} from './uploaded-file.decorator';

class CaptionDto {
  @IsString()
  @IsNotEmpty()
  caption: string;
}

@Controller('t')
class TestController {
  @Post('required')
  required(@UploadedFile('image') file: UploadedFileData) {
    return { name: file.originalName, size: file.size, field: file.field };
  }

  @Post('optional')
  optional(@UploadedFile({ required: false }) file?: UploadedFileData) {
    return { name: file?.originalName ?? null };
  }

  @Post('constrained')
  constrained(
    @UploadedFile({
      field: 'image',
      maxSize: '1kb',
      mimeTypes: ['image/png', 'application/pdf'],
    })
    file: UploadedFileData,
  ) {
    return { mime: file.mimeType };
  }

  @Post('many')
  many(@UploadedFiles() files: UploadedFileData[]) {
    return { count: files.length };
  }

  @Post('with-dto')
  withDto(
    @UploadedFile('image') file: UploadedFileData,
    @MultipartBody(CaptionDto) dto: CaptionDto,
  ) {
    return { name: file.originalName, caption: dto.caption };
  }
}

@Module({ controllers: [TestController] })
class TestModule {}

type Part = [field: string, value: string, filename?: string, mime?: string];

const form = (parts: Part[]) => {
  const boundary = '----spec';
  const payload =
    parts
      .map(([field, value, filename, mime]) =>
        filename
          ? `--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${filename}"\r\nContent-Type: ${mime ?? 'image/png'}\r\n\r\n${value}\r\n`
          : `--${boundary}\r\nContent-Disposition: form-data; name="${field}"\r\n\r\n${value}\r\n`,
      )
      .join('') + `--${boundary}--\r\n`;

  return {
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
    payload,
  };
};

describe('upload decorators', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await NestFactory.create<NestFastifyApplication>(
      TestModule,
      new FastifyAdapter(),
      { logger: false },
    );
    await app.register(multipart, { limits: { fileSize: 1024 * 1024 } });
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor(app.get(Reflector)));
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const post = async (url: string, options: object) => {
    const response = await app.inject({ method: 'POST', url, ...options });
    return {
      status: response.statusCode,
      body: JSON.parse(response.body) as {
        data?: Record<string, unknown>;
        message?: string;
      },
    };
  };

  it('extracts the file from the named field', async () => {
    const { status, body } = await post(
      '/t/required',
      form([['image', 'PNGDATA', 'avatar.png']]),
    );

    expect(status).toBe(201);
    expect(body.data).toEqual({
      name: 'avatar.png',
      size: 7,
      field: 'image',
    });
  });

  it('rejects a non-multipart request', async () => {
    const { status, body } = await post('/t/required', {
      headers: { 'content-type': 'application/json' },
      payload: {},
    });

    expect(status).toBe(400);
    expect(body.message).toBe(StorageMessage.MULTIPART_REQUIRED);
  });

  it('rejects when the named field carries no file', async () => {
    const { status, body } = await post(
      '/t/required',
      form([['other', 'DATA', 'avatar.png']]),
    );

    expect(status).toBe(400);
    expect(body.message).toBe(StorageMessage.FILE_FIELD_MISSING);
  });

  it('allows an absent file when required is false', async () => {
    const { status, body } = await post(
      '/t/optional',
      form([['caption', 'no file here']]),
    );

    expect(status).toBe(201);
    expect(body.data).toEqual({ name: null });
  });

  it('accepts a permitted MIME type', async () => {
    const { status, body } = await post(
      '/t/constrained',
      form([['image', 'PDF', 'doc.pdf', 'application/pdf']]),
    );

    expect(status).toBe(201);
    expect(body.data).toEqual({ mime: 'application/pdf' });
  });

  it('rejects a MIME type outside the allow-list with 415', async () => {
    const { status, body } = await post(
      '/t/constrained',
      form([['image', 'GIF', 'a.gif', 'image/gif']]),
    );

    expect(status).toBe(415);
    expect(body.message).toBe(StorageMessage.MIME_NOT_ALLOWED);
  });

  it('rejects a file above maxSize with 413', async () => {
    const { status, body } = await post(
      '/t/constrained',
      form([['image', 'X'.repeat(2000), 'big.png', 'image/png']]),
    );

    expect(status).toBe(413);
    expect(body.message).toBe(StorageMessage.FILE_TOO_LARGE);
  });

  it('collects every file part', async () => {
    const { status, body } = await post(
      '/t/many',
      form([
        ['a', 'ONE', '1.png'],
        ['b', 'TWO', '2.png'],
      ]),
    );

    expect(status).toBe(201);
    expect(body.data).toEqual({ count: 2 });
  });

  it('parses a DTO alongside the file', async () => {
    const { status, body } = await post(
      '/t/with-dto',
      form([
        ['image', 'PNGDATA', 'a.png'],
        ['caption', 'hello world'],
      ]),
    );

    expect(status).toBe(201);
    expect(body.data).toEqual({ name: 'a.png', caption: 'hello world' });
  });

  it('rejects an invalid DTO even though it is a custom decorator', async () => {
    const { status } = await post(
      '/t/with-dto',
      form([['image', 'PNGDATA', 'a.png']]),
    );

    expect(status).toBe(400);
  });
});
