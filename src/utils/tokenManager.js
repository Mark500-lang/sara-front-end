import { Capacitor } from '@capacitor/core';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';

class TokenManager {
  constructor() {
    this.initialized = false;
    this.isNative = Capacitor.isNativePlatform();
    console.log(`TokenManager: Running in ${this.isNative ? 'native' : 'browser'} environment`);
  }

  async initialize() {
    if (this.initialized) return;
    
    // Only initialize secure storage in native environment
    if (this.isNative) {
      try {
        await SecureStorage.configure({
          key: 'auth_token_storage',
          mode: 'SecureStorageMode.AES'
        });
        this.initialized = true;
        console.log('Secure storage initialized');
      } catch (error) {
        console.error('Failed to initialize secure storage:', error);
      }
    } else {
      console.log('Running in browser - using localStorage fallback');
      this.initialized = true;
    }
  }

  async setToken(token) {
    try {
      await this.initialize();
      
      if (this.isNative) {
        // Use secure storage in native app
        await SecureStorage.set({ key: 'auth_token', value: token });
        console.log('Token stored securely in native storage');
      } else {
        // Use localStorage in browser with a clear identifier
        localStorage.setItem('auth_token', token);
        console.log('Token stored in localStorage (browser fallback)');
      }
      return true;
    } catch (error) {
      console.error('Error storing token:', error);
      // Ultimate fallback
      localStorage.setItem('auth_token_fallback', token);
      return false;
    }
  }

  async getToken() {
    try {
      await this.initialize();
      
      if (this.isNative) {
        // Get from secure storage in native app
        const result = await SecureStorage.get({ key: 'auth_token' });
        return result.value;
      } else {
        // Get from localStorage in browser
        const token = localStorage.getItem('auth_token');
        console.log('Retrieved token from localStorage:', token ? 'Token found' : 'No token');
        return token;
      }
    } catch (error) {
      console.error('Error retrieving token:', error);
      // Fallback to localStorage
      return localStorage.getItem('auth_token_fallback') || localStorage.getItem('auth_token');
    }
  }

  async removeToken() {
    try {
      await this.initialize();
      
      if (this.isNative) {
        await SecureStorage.remove({ key: 'auth_token' });
      }
      
      // Always clear from localStorage as well
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_token_fallback');
      localStorage.removeItem('verification_code'); // Clear old key for compatibility
      
      console.log('Token removed from all storage locations');
    } catch (error) {
      console.error('Error removing token:', error);
    }
  }

  // Helper method to check if we have a token
  async hasToken() {
    const token = await this.getToken();
    return !!token;
  }

  // Method to migrate from old storage method if needed
  async migrateFromOldStorage() {
    if (!this.isNative) {
      const oldToken = localStorage.getItem('verification_code');
      if (oldToken && !localStorage.getItem('auth_token')) {
        console.log('Migrating token from old storage method');
        await this.setToken(oldToken);
        localStorage.removeItem('verification_code');
      }
    }
  }
}

export const tokenManager = new TokenManager();