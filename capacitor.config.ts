import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.p10racing.app',
  appName: 'P10 Racing',
  webDir: 'out',
  backgroundColor: '#15151e',
  server: {
    androidScheme: 'https',
    hostname: 'p10-racing.vercel.app'
  },
  plugins: {
    StatusBar: {
      overlaysWebView: true
    }
  }
};

export default config;
