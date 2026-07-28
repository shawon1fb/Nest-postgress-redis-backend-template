const UNITS: Record<string, number> = {
  b: 1,
  kb: 1024,
  mb: 1024 * 1024,
  gb: 1024 * 1024 * 1024,
};

const SIZE_PATTERN = /^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)$/i;

/**
 * Accepts a byte count or a human-readable size so limits read the way they
 * are discussed: `maxSize: '5mb'` instead of `maxSize: 5242880`.
 */
export function toBytes(size: number | string): number {
  if (typeof size === 'number') {
    return size;
  }

  const match = SIZE_PATTERN.exec(size.trim());
  if (!match) {
    throw new Error(
      `Invalid file size "${size}". Use a number of bytes or a value like "5mb".`,
    );
  }

  return Math.floor(Number(match[1]) * UNITS[match[2].toLowerCase()]);
}
