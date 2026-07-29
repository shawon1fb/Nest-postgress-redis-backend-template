import { BadRequestException } from '@nestjs/common';
import { Readable } from 'stream';
import { FastifyReply } from 'fastify';
import { StorageMessage } from '../common/i18n';
import { UploadedFileData } from '../common/multipart';
import { UserResponseDto } from '../users/dto';
import { FileResponseDto } from './dto';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';

describe('StorageController', () => {
  const record = {
    id: 'file-id',
    key: 'uploads/2026/07/a.png',
    mimeType: 'image/png',
    size: 12,
    originalName: 'a.png',
  } as FileResponseDto;

  const service = {
    upload: jest.fn().mockResolvedValue(record),
    findAll: jest.fn().mockResolvedValue({ data: [record], meta: {} }),
    findOne: jest.fn().mockResolvedValue(record),
    getUrl: jest
      .fn()
      .mockResolvedValue({ url: 'https://cdn/a.png', expiresIn: 900 }),
    download: jest
      .fn()
      .mockResolvedValue({ stream: Readable.from('bytes'), record }),
    remove: jest.fn().mockResolvedValue({ message: StorageMessage.DELETED }),
  };
  const controller = new StorageController(
    service as unknown as StorageService,
  );

  afterEach(() => jest.clearAllMocks());

  it('upload maps the decorated file onto the service input', async () => {
    const file: UploadedFileData = {
      field: 'file',
      originalName: 'a.png',
      mimeType: 'image/png',
      buffer: Buffer.from('bytes'),
      size: 5,
    };

    await expect(
      controller.upload(file, { id: 'user-id' } as UserResponseDto),
    ).resolves.toBe(record);
    expect(service.upload).toHaveBeenCalledWith({
      buffer: file.buffer,
      originalName: 'a.png',
      mimeType: 'image/png',
      uploadedBy: 'user-id',
    });
  });

  it('upload tolerates an anonymous caller', async () => {
    await controller.upload(
      {
        field: 'file',
        originalName: 'a.png',
        mimeType: 'image/png',
        buffer: Buffer.alloc(1),
        size: 1,
      },
      undefined as unknown as UserResponseDto,
    );

    expect(service.upload).toHaveBeenCalledWith(
      expect.objectContaining({ uploadedBy: undefined }),
    );
  });

  it('findAll passes the query through', async () => {
    await controller.findAll({ page: 1 } as never);

    expect(service.findAll).toHaveBeenCalledWith({ page: 1 });
  });

  it('findOne returns the metadata', async () => {
    await expect(controller.findOne('file-id')).resolves.toBe(record);
  });

  describe('getUrl', () => {
    it('uses the driver default when expiresIn is omitted', async () => {
      await controller.getUrl('file-id', undefined);

      expect(service.getUrl).toHaveBeenCalledWith('file-id', undefined);
    });

    it('forwards a positive expiry', async () => {
      await controller.getUrl('file-id', '120');

      expect(service.getUrl).toHaveBeenCalledWith('file-id', 120);
    });

    it.each(['0', '-5', 'abc'])('rejects expiresIn=%s', async (value) => {
      await expect(controller.getUrl('file-id', value)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(service.getUrl).not.toHaveBeenCalled();
    });
  });

  it('download streams the bytes with content headers', async () => {
    const headers: Record<string, unknown> = {};
    const reply = {
      header: jest.fn((name: string, value: unknown) => {
        headers[name] = value;
        return reply;
      }),
      send: jest.fn().mockResolvedValue(undefined),
    } as unknown as FastifyReply;

    await controller.download('file-id', reply);

    expect(headers['Content-Type']).toBe('image/png');
    expect(headers['Content-Length']).toBe(12);
    expect(headers['Content-Disposition']).toContain('a.png');
    expect((reply as unknown as { send: jest.Mock }).send).toHaveBeenCalled();
  });

  it('remove deletes the file', async () => {
    await expect(controller.remove('file-id')).resolves.toEqual({
      message: StorageMessage.DELETED,
    });
  });
});
