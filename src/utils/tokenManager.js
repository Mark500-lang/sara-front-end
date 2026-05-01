import { Capacitor }     from '@capacitor/core';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { Preferences }   from '@capacitor/preferences';   // ← ADD THIS IMPORT

const OLD_KEYS = [
  'verification_token',
  'verification_code',
  'auth_token_fallback',
];

// Capacitor Preferences keys written by the old system that must be cleared
const OLD_PREFERENCES_KEYS = [
  'isSubscribed',
  'booksData',
  'booksDataTimestamp',
];

const TOKEN_KEY     = 'auth_token';
const API_BASE_URL  = 'https://kithia.com/website_b5d91c8e/api';

class TokenManager {
  constructor() {
    this._isNative    = Capacitor.isNativePlatform();
    this._initPromise = null;
    console.log(`[TokenManager] Platform: ${this._isNative ? 'native' : 'browser'}`);
  }

  initialize() {
    if (this._initPromise) return this._initPromise;

    this._initPromise = (async () => {
      if (!this._isNative) {
        console.log('[TokenManager] Browser env — using localStorage');
        OLD_KEYS.forEach(k => localStorage.removeItem(k));
        localStorage.removeItem('isSubscribed');
        return;
      }
      try {
        await SecureStorage.configure({
          key:  'auth_token_storage',
          mode: 'SecureStorageMode.AES',
        });
        console.log('[TokenManager] SecureStorage configured');
      } catch (err) {
        console.warn('[TokenManager] SecureStorage.configure failed, using localStorage:', err.message);
        this._isNative = false;
      }
    })();

    return this._initPromise;
  }

  async setToken(token) {
    await this.initialize();
    try {
      if (this._isNative) {
        await SecureStorage.set({ key: TOKEN_KEY, value: token });
        console.log('[TokenManager] Token saved to SecureStorage');
      } else {
        localStorage.setItem(TOKEN_KEY, token);
        console.log('[TokenManager] Token saved to localStorage');
      }
      return true;
    } catch (err) {
      console.error('[TokenManager] setToken failed:', err.message);
      localStorage.setItem(TOKEN_KEY + '_fallback', token);
      return false;
    }
  }

  async getToken() {
    await this.initialize();
    try {
      if (this._isNative) {
        const result = await SecureStorage.get({ key: TOKEN_KEY });
        return result?.value ?? null;
      }
      return (
        localStorage.getItem(TOKEN_KEY) ??
        localStorage.getItem(TOKEN_KEY + '_fallback') ??
        null
      );
    } catch (err) {
      console.error('[TokenManager] getToken failed:', err.message);
      return (
        localStorage.getItem(TOKEN_KEY) ??
        localStorage.getItem(TOKEN_KEY + '_fallback') ??
        null
      );
    }
  }

  async removeToken() {
    await this.initialize();
    try {
      if (this._isNative) await SecureStorage.remove({ key: TOKEN_KEY });
    } catch (err) {
      console.warn('[TokenManager] SecureStorage.remove failed:', err.message);
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY + '_fallback');

    // Purge all legacy SecureStorage keys
    for (const oldKey of OLD_KEYS) {
      try {
        if (this._isNative) await SecureStorage.remove({ key: oldKey });
      } catch {}
      localStorage.removeItem(oldKey);
    }

    // Purge Preferences cache
    for (const prefKey of OLD_PREFERENCES_KEYS) {
      try { await Preferences.remove({ key: prefKey }); } catch {}
    }

    console.log('[TokenManager] Token and all legacy keys cleared');
  }

  async migrateIfNeeded() {
    await this.initialize();

    // ── Always purge stale Preferences on every launch ───────────────────
    // isSubscribed in Preferences is the main culprit — it makes Homepage
    // think the user is subscribed before the real check completes.
    // We clear it unconditionally so Homepage always does a fresh check.
    for (const prefKey of OLD_PREFERENCES_KEYS) {
      try { await Preferences.remove({ key: prefKey }); } catch {}
    }
    localStorage.removeItem('isSubscribed');

    // ── Scan for old SecureStorage / localStorage keys ────────────────────
    let foundOldToken = false;
    for (const oldKey of OLD_KEYS) {
      let oldVal = null;
      try {
        if (this._isNative) {
          const r = await SecureStorage.get({ key: oldKey });
          oldVal = r?.value ?? null;
        } else {
          oldVal = localStorage.getItem(oldKey);
        }
      } catch {}

      if (oldVal) {
        console.warn(`[TokenManager] Found legacy token under "${oldKey}" — removing.`);
        foundOldToken = true;
        try {
          if (this._isNative) await SecureStorage.remove({ key: oldKey });
        } catch {}
        localStorage.removeItem(oldKey);
      }
    }

    if (foundOldToken) {
      await this.removeToken();
      console.log('[TokenManager] Migration: old tokens destroyed. Will re-register.');
      return;
    }

    // ── Validate existing main token against backend ──────────────────────
    const token = await this.getToken();
    if (!token) return;

    try {
      const controller = new AbortController();
      const timeout    = setTimeout(() => controller.abort(), 5000);
      const response   = await fetch(`${API_BASE_URL}/user/subscription-status`, {
        method:  'GET',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        signal:  controller.signal,
      });
      clearTimeout(timeout);

      if (response.status === 401) {
        console.warn('[TokenManager] Migration: token rejected (401) — clearing for re-registration.');
        await this.removeToken();
      } else {
        console.log('[TokenManager] Migration: existing token is valid.');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('[TokenManager] Migration: network error — keeping token:', err.message);
      }
    }
  }
}

export const tokenManager = new TokenManager();