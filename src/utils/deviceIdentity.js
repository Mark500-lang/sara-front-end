import { Capacitor }     from '@capacitor/core';
import { Device }        from '@capacitor/device';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';

const DEVICE_ID_KEY = 'sara_device_uuid';
const API_BASE_URL  = 'https://kithia.com/website_b5d91c8e/api';
const IS_NATIVE     = Capacitor.isNativePlatform();

// ── Module-level singleton ────────────────────────────────────────────────────
// If initDeviceIdentity is called a second time while the first is still
// running (React Strict Mode double-invoke, multiple components calling it
// on mount), the second call returns the SAME promise instead of starting
// a new registration. This guarantees only one UUID is ever generated and
// only one /register-device POST is ever made per app session.
let _initPromise = null;

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

// ── Storage ───────────────────────────────────────────────────────────────────
const storeDeviceId = async (uuid) => {
  try {
    if (IS_NATIVE) {
      await SecureStorage.set({ key: DEVICE_ID_KEY, value: uuid });
    } else {
      localStorage.setItem(DEVICE_ID_KEY, uuid);
    }
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

// ── Token validation ──────────────────────────────────────────────────────────
const validateToken = async (token) => {
  if (!token) return false;
  try {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 5000);
    const response   = await fetch(`${API_BASE_URL}/user/subscription-status`, {
      method:  'GET',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      signal:  controller.signal,
    });
    clearTimeout(timeout);
    return response.status !== 401;
  } catch {
    return true; // Network error — assume valid, avoid unnecessary re-registration
  }
};

// ── Backend registration ──────────────────────────────────────────────────────
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
      body: JSON.stringify({ device_uuid: deviceId, platform, model, os_version: osVersion }),
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

// ── Main export ───────────────────────────────────────────────────────────────
export const initDeviceIdentity = (tokenManager) => {
  // If already running or completed this session, return the same promise.
  // This is the key fix — concurrent callers share one execution, so only
  // one UUID is generated and only one /register-device POST fires.
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    try {
      // Step 1 — Get or generate UUID
      let deviceId = await retrieveDeviceId();
      if (!deviceId) {
        deviceId = generateUUID();
        await storeDeviceId(deviceId);
        console.log('[DeviceIdentity] First launch — UUID generated:', deviceId);
      } else {
        console.log('[DeviceIdentity] Existing UUID:', deviceId);
      }

      // Step 2 — Validate existing token
      const existingToken = await tokenManager.getToken();
      if (existingToken) {
        const isValid = await validateToken(existingToken);
        if (isValid) {
          console.log('[DeviceIdentity] Token valid — skipping registration.');
          return deviceId;
        }
        console.warn('[DeviceIdentity] Token invalid — clearing and re-registering.');
        await tokenManager.removeToken();
        // Reset the promise so a fresh registration can be attempted next
        // app session if this one also fails
      }

      // Step 3 — Register
      console.log('[DeviceIdentity] Registering with backend...');
      await registerWithBackend(deviceId, tokenManager);
      return deviceId;

    } catch (err) {
      // Reset singleton so the next app launch retries registration
      _initPromise = null;

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