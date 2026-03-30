import { Capacitor } from '@capacitor/core';
import { Device }    from '@capacitor/device';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';

const DEVICE_ID_KEY = 'sara_device_uuid';
const API_BASE_URL  = 'https://kithia.com/website_b5d91c8e/api';

// Evaluated once at module load — never changes during a session
const IS_NATIVE = Capacitor.isNativePlatform();

// ── UUID ──────────────────────────────────────────────────────────────────────
const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};

// ── UUID storage ──────────────────────────────────────────────────────────────
// Native  → SecureStorage (survives uninstall on iOS Keychain / Android Keystore)
// Browser → localStorage  (survives page refresh; dev-friendly)

const storeDeviceId = async (uuid) => {
  try {
    if (IS_NATIVE) {
      await SecureStorage.set({ key: DEVICE_ID_KEY, value: uuid });
    } else {
      localStorage.setItem(DEVICE_ID_KEY, uuid);
    }
  } catch {
    // If SecureStorage fails, always fall back to localStorage
    localStorage.setItem(DEVICE_ID_KEY, uuid);
  }
};

const retrieveDeviceId = async () => {
  try {
    if (IS_NATIVE) {
      const result = await SecureStorage.get({ key: DEVICE_ID_KEY });
      return result?.value ?? null;
    }
    return localStorage.getItem(DEVICE_ID_KEY) ?? null;
  } catch {
    return localStorage.getItem(DEVICE_ID_KEY) ?? null;
  }
};

// ── Register with backend ─────────────────────────────────────────────────────
// Works on BOTH native AND browser — creates a real row in your users table.
// The backend controller uses firstOrCreate so calling this multiple times
// for the same UUID is completely safe (idempotent).

const registerWithBackend = async (deviceId, tokenManager) => {
  // Collect as much device info as the environment allows
  let platform   = 'web';
  let model      = 'browser';
  let osVersion  = 'unknown';

  try {
    const info = await Device.getInfo();
    platform  = info.platform  || platform;
    model     = info.model     || model;
    osVersion = info.osVersion || osVersion;
  } catch {
    // Device.getInfo() can fail in the browser — keep defaults above
  }

  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 10000); // 10 s hard timeout

  try {
    const response = await fetch(`${API_BASE_URL}/register-device`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      signal:  controller.signal,
      body: JSON.stringify({
        device_uuid: deviceId,
        platform,          // "web" in browser — backend accepts this value
        model,
        os_version: osVersion,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`register-device ${response.status}: ${body}`);
    }

    const data = await response.json();

    if (!data.token) {
      throw new Error('Backend returned no token');
    }

    await tokenManager.setToken(data.token);
    console.log(
      `[DeviceIdentity] Registered. user_id=${data.user_id} is_new=${data.is_new}`
    );
    return data.token;

  } finally {
    clearTimeout(timeout);
  }
};

// ── Main export ───────────────────────────────────────────────────────────────
// Call once on app launch (ChildProfileScreen bootstrap).
// Safe to call multiple times — re-registration is skipped if token exists.

export const initDeviceIdentity = async (tokenManager) => {
  try {
    // ── Step 1: Get or generate stable UUID ──────────────────────────────────
    let deviceId = await retrieveDeviceId();

    if (!deviceId) {
      deviceId = generateUUID();
      await storeDeviceId(deviceId);
      console.log('[DeviceIdentity] First launch — UUID generated:', deviceId);
    } else {
      console.log('[DeviceIdentity] Existing UUID found:', deviceId);
    }

    // ── Step 2: Get or create backend token ──────────────────────────────────
    // If a token already exists this is a returning user — skip registration.
    const existingToken = await tokenManager.getToken();

    if (existingToken) {
      console.log('[DeviceIdentity] Token already present — skipping registration.');
      return deviceId;
    }

    // No token: first launch or token was cleared (e.g. app reinstalled).
    // Call the backend on ALL platforms including the browser.
    console.log('[DeviceIdentity] No token — registering with backend...');
    await registerWithBackend(deviceId, tokenManager);

    return deviceId;

  } catch (err) {
    if (err.name === 'AbortError') {
      console.warn('[DeviceIdentity] Registration timed out — will retry next launch.');
    } else {
      console.error('[DeviceIdentity] Error:', err.message);
    }
    // Never crash the app — return whatever UUID we have
    return await retrieveDeviceId();
  }
};

// ── Getter ────────────────────────────────────────────────────────────────────
// Use anywhere you need the device UUID (e.g. RevenueCat logIn in BookPage/SubscriptionModal)
export const getDeviceId = async () => {
  return retrieveDeviceId();
};