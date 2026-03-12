import { describe, it, expect } from 'vitest';
import { getContrastColor } from '@/lib/utils/colors';

describe('Color Utility Tests', () => {
  it('should return white text for dark backgrounds', () => {
    expect(getContrastColor('#000000')).toBe('white');
    expect(getContrastColor('#3671C6')).toBe('white');
    expect(getContrastColor('#E80020')).toBe('white');
    expect(getContrastColor('#229971')).toBe('white');
  });

  it('should return black text for light backgrounds', () => {
    expect(getContrastColor('#FFFFFF')).toBe('black');
    expect(getContrastColor('#ffffff')).toBe('black');
    expect(getContrastColor('#27F4D2')).toBe('black');
    expect(getContrastColor('#FF8000')).toBe('black');
    expect(getContrastColor('#B6BABD')).toBe('black');
  });

  it('should handle 3-digit hex codes', () => {
    expect(getContrastColor('#000')).toBe('white');
    expect(getContrastColor('#FFF')).toBe('black');
  });

  it('should handle hex codes without hashes', () => {
    expect(getContrastColor('000000')).toBe('white');
    expect(getContrastColor('FFFFFF')).toBe('black');
  });
});
