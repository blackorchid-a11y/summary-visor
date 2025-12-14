import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mirsummaries.app',
  appName: 'Visor Temas MIR',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  ios: {
    contentInset: 'always',
    limitsNavigationsToAppBoundDomains: false
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    }
  }
};

export default config;
