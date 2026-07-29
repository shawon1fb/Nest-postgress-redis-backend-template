import { BadRequestException } from '@nestjs/common';
import { PaginationUtil } from './pagination.util';

describe('PaginationUtil', () => {
  describe('validateAndNormalizePagination', () => {
    it('applies defaults when nothing is supplied', () => {
      expect(PaginationUtil.validateAndNormalizePagination({})).toEqual({
        page: 1,
        limit: 10,
        offset: 0,
        sortBy: undefined,
        sortOrder: 'asc',
      });
    });

    it('computes the offset from page and limit', () => {
      const { offset } = PaginationUtil.validateAndNormalizePagination({
        page: 3,
        limit: 25,
      });

      expect(offset).toBe(50);
    });

    it('clamps a page below 1 up to the first page', () => {
      expect(
        PaginationUtil.validateAndNormalizePagination({ page: -5 }).page,
      ).toBe(1);
      expect(
        PaginationUtil.validateAndNormalizePagination({ page: 0 }).page,
      ).toBe(1);
    });

    it('clamps the limit into the allowed range', () => {
      expect(
        PaginationUtil.validateAndNormalizePagination({ limit: 5000 }).limit,
      ).toBe(PaginationUtil.MAX_LIMIT);
      // A negative limit is truthy, so it is floored at 1 rather than
      // falling back to the default.
      expect(
        PaginationUtil.validateAndNormalizePagination({ limit: -1 }).limit,
      ).toBe(1);
      // Zero is falsy, so it does fall back to the default.
      expect(
        PaginationUtil.validateAndNormalizePagination({ limit: 0 }).limit,
      ).toBe(PaginationUtil.DEFAULT_LIMIT);
    });

    it('only accepts desc as a descending order, defaulting to asc', () => {
      expect(
        PaginationUtil.validateAndNormalizePagination({ sortOrder: 'desc' })
          .sortOrder,
      ).toBe('desc');
      expect(
        PaginationUtil.validateAndNormalizePagination({ sortOrder: 'asc' })
          .sortOrder,
      ).toBe('asc');
    });

    it('passes an allowed sort field through', () => {
      expect(
        PaginationUtil.validateAndNormalizePagination({ sortBy: 'createdAt' })
          .sortBy,
      ).toBe('createdAt');
    });

    it('rejects a sort field outside the allow-list', () => {
      expect(() =>
        PaginationUtil.validateAndNormalizePagination({
          sortBy: 'password',
        }),
      ).toThrow(BadRequestException);
    });
  });

  describe('createPaginationResult', () => {
    it('builds metadata for a middle page', () => {
      const result = PaginationUtil.createPaginationResult(['a'], 25, 2, 10);

      expect(result).toEqual({
        data: ['a'],
        meta: {
          total: 25,
          page: 2,
          limit: 10,
          totalPages: 3,
          hasNextPage: true,
          hasPreviousPage: true,
        },
      });
    });

    it('reports no neighbours on a single page', () => {
      const { meta } = PaginationUtil.createPaginationResult([], 5, 1, 10);

      expect(meta.totalPages).toBe(1);
      expect(meta.hasNextPage).toBe(false);
      expect(meta.hasPreviousPage).toBe(false);
    });

    it('handles an empty result set', () => {
      const { meta } = PaginationUtil.createPaginationResult([], 0, 1, 10);

      expect(meta.totalPages).toBe(0);
      expect(meta.hasNextPage).toBe(false);
    });

    it('marks the last page as having no next page', () => {
      const { meta } = PaginationUtil.createPaginationResult([], 30, 3, 10);

      expect(meta.hasNextPage).toBe(false);
      expect(meta.hasPreviousPage).toBe(true);
    });
  });

  describe('buildSearchConditions', () => {
    it('returns nothing for an empty or blank term', () => {
      expect(PaginationUtil.buildSearchConditions()).toEqual([]);
      expect(PaginationUtil.buildSearchConditions('')).toEqual([]);
      expect(PaginationUtil.buildSearchConditions('   ')).toEqual([]);
    });

    it('builds a lowercased LIKE clause per searchable column', () => {
      const conditions = PaginationUtil.buildSearchConditions('  ADmin ');

      expect(conditions).toHaveLength(4);
      expect(conditions.every((clause) => clause.includes("'%admin%'"))).toBe(
        true,
      );
    });
  });
});
