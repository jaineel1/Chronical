import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jaineel.chronicle',
  appName: 'Chronicle',
  webDir: 'dist',
  backgroundColor: '#ebe3d4',
  ios: {
    contentInset: 'never',
    backgroundColor: '#3a1219',
  },
  plugins: {
    SplashScreen: { launchShowDuration: 600, backgroundColor: '#3a1219', showSpinner: false },
    StatusBar: { style: 'DARK', backgroundColor: '#3a1219', overlaysWebView: false },
    LocalNotifications: { iconColor: '#b8323b' },
  },
};

export default config;
