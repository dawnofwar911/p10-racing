import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getContrastColor } from '@/lib/utils/colors';
import { getDriverDisplayName } from '@/lib/utils/drivers';
import { 
  getPredictionKey, 
  getGridKey, 
  getResultsKey, 
  setStorageItem, 
  removeStorageItem,
  STORAGE_UPDATE_EVENT,
  STORAGE_KEYS
} from '@/lib/utils/storage';

describe('Color Utility Tests', () => {
  it('should return white text for dark backgrounds', () => {
    expect(getContrastColor('#000000')).toBe('white');
    expect(getContrastColor('#3671C6')).toBe('white');
  });

  it('should return black text for light backgrounds', () => {
    expect(getContrastColor('#FFFFFF')).toBe('black');
    expect(getContrastColor('#27F4D2')).toBe('black');
  });

  it('should handle 3-digit hex codes', () => {
    expect(getContrastColor('#000')).toBe('white');
    expect(getContrastColor('#FFF')).toBe('black');
  });
});

describe('Driver Utility Tests', () => {
  const drivers = [
    { id: 'max_verstappen', name: 'Max Verstappen' },
    { id: 'hamilton', name: 'Lewis Hamilton' }
  ] as any;

  it('should extract the last name', () => {
    expect(getDriverDisplayName('max_verstappen', drivers)).toBe('Verstappen');
    expect(getDriverDisplayName('hamilton', drivers)).toBe('Hamilton');
  });

  it('should fallback to Uppercase ID if driver not found', () => {
    expect(getDriverDisplayName('alonso', [])).toBe('ALONSO');
    expect(getDriverDisplayName('perez', [])).toBe('PEREZ');
  });
});

describe('Storage Utility Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should generate correct prediction keys', () => {
    expect(getPredictionKey(2026, 'user1', '1')).toBe(`${STORAGE_KEYS.PRED_PREFIX}2026_user1_1`);
  });

  it('should generate correct grid keys', () => {
    expect(getGridKey('1')).toBe(`${STORAGE_KEYS.GRID_PREFIX}1`);
  });

  it('should generate correct results keys', () => {
    expect(getResultsKey(2026, '1')).toBe(`${STORAGE_KEYS.RESULTS_PREFIX}2026_1`);
  });

  it('should set storage item and dispatch event', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    setStorageItem('test_key', 'test_value');
    
    expect(localStorage.getItem('test_key')).toBe('test_value');
    expect(dispatchSpy).toHaveBeenCalled();
    const event = dispatchSpy.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe(STORAGE_UPDATE_EVENT);
    expect(event.detail.key).toBe('test_key');
  });

  it('should remove storage item and dispatch event', () => {
    localStorage.setItem('test_key', 'test_value');
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    removeStorageItem('test_key');
    
    expect(localStorage.getItem('test_key')).toBeNull();
    expect(dispatchSpy).toHaveBeenCalled();
    const event = dispatchSpy.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe(STORAGE_UPDATE_EVENT);
    expect(event.detail.key).toBe('test_key');
  });
});
