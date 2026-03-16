import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.p10racing.app',
  appName: 'P10 Racing',
  webDir: 'out',
  backgroundColor: '#15151e',
  server: {
    androidScheme: 'https',
    hostname: 'p10racing.app'
  },
  plugins: {
    BackgroundRunner: {
      label: 'com.p10racing.app.background',
      src: 'background.js',
      event: 'syncTask',
      repeat: true,
      interval: 15, // minutes (minimum for Android)
      autoStart: true,
    },
  },
};

export default config;
