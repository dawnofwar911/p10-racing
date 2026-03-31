import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { Network } from '@capacitor/network';
import { STORAGE_KEYS } from './storage';
import packageInfo from '../../package.json';

export interface DiagnosticData {
  app_version: string;
  platform: string;
  os_version?: string;
  manufacturer?: string;
  model?: string;
  is_virtual?: boolean;
  mem_used?: number;
  battery_level?: number;
  is_charging?: boolean;
  network_status: string;
  connection_type: string;
  url: string;
  source_url: string;
  screen: string;
  user_agent: string;
  storage_summary: Record<string, string | number | boolean | undefined>;
  recent_errors: string[];
}

export const getStorageSummary = () => {
  if (typeof window === 'undefined') return {};
  try {
    const keys = Object.keys(localStorage);
    return {
      total_keys: keys.length,
      has_session: !!localStorage.getItem(STORAGE_KEYS.HAS_SESSION),
      has_predictions: keys.some(k => k.startsWith(STORAGE_KEYS.PRED_PREFIX)),
      has_drivers: !!localStorage.getItem(STORAGE_KEYS.CACHE_DRIVERS),
      has_grid: keys.some(k => k.startsWith(STORAGE_KEYS.GRID_PREFIX)),
    };
  } catch {
    return { error: 'Failed to access localStorage' };
  }
};

export const gatherDiagnostics = async (): Promise<DiagnosticData> => {
  const info = await Device.getInfo();
  const battery = await Device.getBatteryInfo();
  const network = await Network.getStatus();

  return {
    app_version: packageInfo.version,
    platform: Capacitor.getPlatform(),
    os_version: info.osVersion,
    manufacturer: info.manufacturer,
    model: info.model,
    is_virtual: info.isVirtual,
    mem_used: info.memUsed,
    battery_level: battery.batteryLevel,
    is_charging: battery.isCharging,
    network_status: network.connected ? 'online' : 'offline',
    connection_type: network.connectionType,
    url: typeof window !== 'undefined' ? window.location.href : 'unknown',
    source_url: (typeof window !== 'undefined' ? window.__P10_LAST_URL__ || window.location.href : 'unknown'),
    screen: typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}` : 'unknown',
    user_agent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown',
    storage_summary: getStorageSummary(),
    recent_errors: typeof window !== 'undefined' ? window.__P10_ERROR_LOGS__ || [] : []
  };
};
