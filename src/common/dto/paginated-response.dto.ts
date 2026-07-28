import { ApiProperty } from '@nestjs/swagger';
import { PaginationUtil } from '../utils/pagination.util';

/**
 * Pagination metadata. Field names must stay in sync with
 * `PaginationUtil.createPaginationResult`, which is the only place meta is
 * built.
 */
export class PaginationMetaDto {
  @ApiProperty({
    description: 'Total number of items matching the query',
    example: 150,
    minimum: 0,
  })
  total: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
    minimum: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 10,
    minimum: 1,
    maximum: 100,
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 15,
    minimum: 0,
  })
  totalPages: number;

  @ApiProperty({
    description: 'Whether a next page exists',
    example: true,
  })
  hasNextPage: boolean;

  @ApiProperty({
    description: 'Whether a previous page exists',
    example: false,
  })
  hasPreviousPage: boolean;
}

/**
 * Generic paginated payload returned by any service that lists records.
 *
 * Reuse it directly — modules should not declare their own paginated DTO:
 *
 * ```ts
 * // service
 * return PaginatedResponseDto.create(items, total, page, limit);
 *
 * // controller
 * @ApiEnvelopePaginatedResponse(ItemResponseDto, { status: 200, description: '...' })
 * findAll(): Promise<PaginatedResponseDto<ItemResponseDto>> { ... }
 * ```
 *
 * Swagger never resolves the generic itself; the per-item schema is supplied by
 * `ApiEnvelopePaginatedResponse(model)`.
 */
export class PaginatedResponseDto<T> {
  data: T[];

  meta: PaginationMetaDto;

  constructor(data: T[], meta: PaginationMetaDto) {
    this.data = data;
    this.meta = meta;
  }

  static create<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
  ): PaginatedResponseDto<T> {
    const result = PaginationUtil.createPaginationResult(
      data,
      total,
      page,
      limit,
    );
    return new PaginatedResponseDto<T>(result.data, result.meta);
  }
}
