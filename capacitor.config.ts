import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.p10racing.app',
  appName: 'P10 Racing',
  webDir: 'out',
  backgroundColor: '#15151e',
  server: {
    androidScheme: 'https',
    hostname: 'p10racing.app'
  }
};

export default config;
