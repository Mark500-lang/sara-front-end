import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.littlestories.app',
  appName: 'sara-stories',
  webDir: 'build',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SecureStorage: {
      key: 'auth_token_storage',
      mode: 'AES'
    }
  }
};

export default config;