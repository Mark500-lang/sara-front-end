import { Capacitor }     from '@capacitor/core';
import { Device }        from '@capacitor/device';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';

const DEVICE_ID_KEY = 'sara_device_uuid';
const API_BASE_URL  = 'https://kithia.com/website_b5d91c8e/api';
const IS_NATIVE     = Capacitor.isNativePlatform();

let _initPromise = null;

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};

const storeDeviceId = async (uuid) => {
  try {
    if (IS_NATIVE) await SecureStorage.set({ key: DEVICE_ID_KEY, value: uuid });
    else           localStorage.setItem(DEVICE_ID_KEY, uuid);
  } catch {
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

const registerWithBackend = async (deviceId, tokenManager) => {
  let platform  = 'web';
  let model     = 'browser';
  let osVersion = 'unknown';
  try {
    const info = await Device.getInfo();
    platform  = info.platform  || platform;
    model     = info.model     || model;
    osVersion = info.osVersion || osVersion;
  } catch {}

  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${API_BASE_URL}/register-device`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      signal:  controller.signal,
      body:    JSON.stringify({ device_uuid: deviceId, platform, model, os_version: osVersion }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`register-device ${response.status}: ${body}`);
    }
    const data = await response.json();
    if (!data.token) throw new Error('Backend returned no token');
    await tokenManager.setToken(data.token);
    console.log(`[DeviceIdentity] Registered. user_id=${data.user_id} is_new=${data.is_new}`);
    return data.token;
  } finally {
    clearTimeout(timeout);
  }
};

export const initDeviceIdentity = (tokenManager) => {
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    try {
      // ── MIGRATION FIRST ───────────────────────────────────────────────────
      // This must run before anything else. It will:
      //   1. Detect and destroy any tokens left by the old child-registration system
      //   2. Validate the current token against the backend — if 401, clear it
      // After this call, tokenManager.getToken() either returns a valid token
      // or null, and we proceed accordingly.
      await tokenManager.migrateIfNeeded();

      // ── Get or generate UUID ──────────────────────────────────────────────
      let deviceId = await retrieveDeviceId();
      if (!deviceId) {
        deviceId = generateUUID();
        await storeDeviceId(deviceId);
        console.log('[DeviceIdentity] First launch — UUID generated:', deviceId);
      } else {
        console.log('[DeviceIdentity] Existing UUID:', deviceId);
      }

      // ── Check token ───────────────────────────────────────────────────────
      // migrateIfNeeded already validated/cleared the token, so if it's
      // still here it's valid — skip registration.
      const existingToken = await tokenManager.getToken();
      if (existingToken) {
        console.log('[DeviceIdentity] Token valid — skipping registration.');
        return deviceId;
      }

      // ── Register ──────────────────────────────────────────────────────────
      console.log('[DeviceIdentity] No token — registering with backend...');
      await registerWithBackend(deviceId, tokenManager);
      return deviceId;

    } catch (err) {
      _initPromise = null; // Allow retry on next launch
      if (err.name === 'AbortError') {
        console.warn('[DeviceIdentity] Registration timed out — will retry next launch.');
      } else {
        console.error('[DeviceIdentity] Error:', err.message);
      }
      return await retrieveDeviceId();
    }
  })();

  return _initPromise;
};

export const getDeviceId = async () => retrieveDeviceId();