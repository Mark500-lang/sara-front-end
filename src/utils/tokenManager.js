import { Capacitor } from '@capacitor/core';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';

class TokenManager {
  constructor() {
    // Evaluate platform once at construction time
    this._isNative    = Capacitor.isNativePlatform();
    // _initPromise ensures initialize() body runs exactly once,
    // even if called concurrently from multiple places
    this._initPromise = null;

    console.log(`[TokenManager] Platform: ${this._isNative ? 'native' : 'browser'}`);
  }

  // ── Singleton initialiser ───────────────────────────────────────────────────
  // Safe to call multiple times — subsequent calls return the cached promise
  initialize() {
    if (this._initPromise) return this._initPromise;

    this._initPromise = (async () => {
      if (!this._isNative) {
        // Browser — localStorage needs no setup
        console.log('[TokenManager] Browser env — using localStorage');
        return;
      }

      try {
        await SecureStorage.configure({
          key:  'auth_token_storage',
          mode: 'SecureStorageMode.AES',
        });
        console.log('[TokenManager] SecureStorage configured');
      } catch (err) {
        // SecureStorage unavailable (simulator, old OS, etc.)
        // Downgrade gracefully — never hang
        console.warn('[TokenManager] SecureStorage.configure failed, downgrading to localStorage:', err.message);
        this._isNative = false;
      }
    })();

    return this._initPromise;
  }

  // ── Write ───────────────────────────────────────────────────────────────────
  async setToken(token) {
    await this.initialize();
    try {
      if (this._isNative) {
        await SecureStorage.set({ key: 'auth_token', value: token });
        console.log('[TokenManager] Token saved to SecureStorage');
      } else {
        localStorage.setItem('auth_token', token);
        console.log('[TokenManager] Token saved to localStorage');
      }
      return true;
    } catch (err) {
      console.error('[TokenManager] setToken failed:', err.message);
      // Ultimate fallback so the token is never simply lost
      localStorage.setItem('auth_token_fallback', token);
      return false;
    }
  }

  // ── Read ────────────────────────────────────────────────────────────────────
  async getToken() {
    await this.initialize();
    try {
      if (this._isNative) {
        const result = await SecureStorage.get({ key: 'auth_token' });
        return result?.value ?? null;
      }
      // Browser: check primary key first, then fallback key
      return (
        localStorage.getItem('auth_token') ??
        localStorage.getItem('auth_token_fallback') ??
        null
      );
    } catch (err) {
      console.error('[TokenManager] getToken failed:', err.message);
      return (
        localStorage.getItem('auth_token') ??
        localStorage.getItem('auth_token_fallback') ??
        null
      );
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  async removeToken() {
    await this.initialize();
    try {
      if (this._isNative) {
        await SecureStorage.remove({ key: 'auth_token' });
      }
    } catch (err) {
      console.warn('[TokenManager] SecureStorage.remove failed:', err.message);
    }
    // Always clear localStorage copies as well
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_token_fallback');
    localStorage.removeItem('verification_code'); // legacy key
    console.log('[TokenManager] Token cleared from all storage');
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  async hasToken() {
    const token = await this.getToken();
    return !!token;
  }

  // Migrate tokens stored under the old key used before this system
  async migrateFromOldStorage() {
    const oldToken = localStorage.getItem('verification_code');
    if (oldToken && !(await this.hasToken())) {
      console.log('[TokenManager] Migrating token from old storage');
      await this.setToken(oldToken);
      localStorage.removeItem('verification_code');
    }
  }
}

export const tokenManager = new TokenManager();