import { toBytes } from './file-size.util';

describe('toBytes', () => {
  it('passes plain byte counts through', () => {
    expect(toBytes(2048)).toBe(2048);
  });

  it('parses readable sizes', () => {
    expect(toBytes('512b')).toBe(512);
    expect(toBytes('1kb')).toBe(1024);
    expect(toBytes('5mb')).toBe(5 * 1024 * 1024);
    expect(toBytes('2gb')).toBe(2 * 1024 * 1024 * 1024);
  });

  it('tolerates spacing, casing and decimals', () => {
    expect(toBytes(' 5 MB ')).toBe(5 * 1024 * 1024);
    expect(toBytes('1.5mb')).toBe(Math.floor(1.5 * 1024 * 1024));
  });

  it('rejects nonsense instead of silently allowing everything', () => {
    expect(() => toBytes('big')).toThrow(/Invalid file size/);
    expect(() => toBytes('5tb')).toThrow(/Invalid file size/);
    expect(() => toBytes('mb')).toThrow(/Invalid file size/);
  });
});
