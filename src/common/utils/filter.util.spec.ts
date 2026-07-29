import { UserRole } from '../../database/schema';
import { FilterUtil } from './filter.util';

describe('FilterUtil', () => {
  describe('buildUserFilters', () => {
    it('returns no conditions when nothing is filtered', () => {
      expect(FilterUtil.buildUserFilters({})).toEqual([]);
    });

    it('adds one condition per supplied filter', () => {
      const conditions = FilterUtil.buildUserFilters({
        role: UserRole.ADMIN,
        isActive: true,
        isEmailVerified: false,
        search: 'admin',
        dateFrom: new Date('2026-01-01'),
        dateTo: new Date('2026-02-01'),
      });

      expect(conditions).toHaveLength(6);
    });

    it('ignores a role that is not part of the enum', () => {
      const conditions = FilterUtil.buildUserFilters({
        role: 'superuser' as UserRole,
      });

      expect(conditions).toEqual([]);
    });

    it('treats false as a real filter value, not as absent', () => {
      expect(FilterUtil.buildUserFilters({ isActive: false })).toHaveLength(1);
      expect(
        FilterUtil.buildUserFilters({ isEmailVerified: false }),
      ).toHaveLength(1);
    });

    it('skips a blank search term', () => {
      expect(FilterUtil.buildUserFilters({ search: '   ' })).toEqual([]);
    });
  });

  describe('validateDateRange', () => {
    it('accepts an ordered range, a single bound, or none', () => {
      expect(() =>
        FilterUtil.validateDateRange(
          new Date('2026-01-01'),
          new Date('2026-02-01'),
        ),
      ).not.toThrow();
      expect(() =>
        FilterUtil.validateDateRange(new Date('2026-01-01')),
      ).not.toThrow();
      expect(() => FilterUtil.validateDateRange()).not.toThrow();
    });

    it('rejects a reversed range', () => {
      expect(() =>
        FilterUtil.validateDateRange(
          new Date('2026-03-01'),
          new Date('2026-01-01'),
        ),
      ).toThrow('Date from cannot be greater than date to');
    });
  });

  describe('sanitizeSearchTerm', () => {
    it('returns undefined for empty input', () => {
      expect(FilterUtil.sanitizeSearchTerm()).toBeUndefined();
      expect(FilterUtil.sanitizeSearchTerm('')).toBeUndefined();
      expect(FilterUtil.sanitizeSearchTerm('   ')).toBeUndefined();
    });

    it('escapes SQL wildcards so they cannot widen the search', () => {
      expect(FilterUtil.sanitizeSearchTerm('50%')).toBe('50\\%');
      expect(FilterUtil.sanitizeSearchTerm('a_b')).toBe('a\\_b');
      expect(FilterUtil.sanitizeSearchTerm('back\\slash')).toBe(
        'back\\\\slash',
      );
    });

    it('trims surrounding whitespace', () => {
      expect(FilterUtil.sanitizeSearchTerm('  admin  ')).toBe('admin');
    });
  });

  describe('buildSortCondition', () => {
    it('falls back to created_at DESC without a sort field', () => {
      expect(FilterUtil.buildSortCondition()).toBeDefined();
    });

    it('falls back for a field outside the allow-list', () => {
      const condition = FilterUtil.buildSortCondition('password', 'desc');

      expect(JSON.stringify(condition)).toContain('created_at');
    });

    it('maps camelCase fields onto their snake_case columns', () => {
      expect(
        JSON.stringify(FilterUtil.buildSortCondition('firstName')),
      ).toContain('first_name');
      expect(
        JSON.stringify(FilterUtil.buildSortCondition('lastLoginAt', 'desc')),
      ).toContain('last_login_at');
    });

    it('honours the sort direction', () => {
      expect(
        JSON.stringify(FilterUtil.buildSortCondition('email', 'asc')),
      ).toContain('ASC');
      expect(
        JSON.stringify(FilterUtil.buildSortCondition('email', 'desc')),
      ).toContain('DESC');
    });

    it('leaves an already snake_case-safe field untouched', () => {
      expect(JSON.stringify(FilterUtil.buildSortCondition('email'))).toContain(
        'email',
      );
    });
  });
});
