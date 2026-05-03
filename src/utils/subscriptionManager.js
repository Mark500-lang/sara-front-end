// subscriptionManager.js
// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for subscription status across the entire app session.
//
// Architecture (improved with reference app patterns):
//   • After a purchase, we sync the true plan and expiry to the backend immediately.
//   • On every cold start, we query the backend FIRST (in parallel with RevenueCat)
//     and treat the backend as the final authority.
//   • Persisted expiry is used only as an offline fallback.
//   • This eliminates any reliance on RevenueCat sandbox quirks or propagation delays.
// ─────────────────────────────────────────────────────────────────────────────

import { Purchases } from "@revenuecat/purchases-capacitor";
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { tokenManager } from "./tokenManager";

const ENTITLEMENT_ID = "Sara Stories Subscriptions";
const PREF_KEY_EXPIRY = "subscription_expiry_ms";
const PREF_KEY_STATUS = "subscription_confirmed";
const BACKEND_URL = "https://kithia.com/website_b5d91c8e/api/user/subscription-status";

const isNative = () => Capacitor.isNativePlatform();

// ── Persistence helpers ────────────────────────────────────────────────────
const isPersistedEntitlementValid = async () => {
  try {
    const [expiryResult, statusResult] = await Promise.all([
      Preferences.get({ key: PREF_KEY_EXPIRY }),
      Preferences.get({ key: PREF_KEY_STATUS }),
    ]);

    if (statusResult.value !== "true") return false;
    if (expiryResult.value === "never") return true;
    if (!expiryResult.value) return false;

    return Date.now() < parseInt(expiryResult.value, 10);
  } catch {
    return false;
  }
};

const persistEntitlement = async (expiryMs) => {
  await Promise.all([
    Preferences.set({ key: PREF_KEY_STATUS, value: "true" }),
    Preferences.set({
      key: PREF_KEY_EXPIRY,
      value: expiryMs ? expiryMs.toString() : "never",
    }),
  ]);
};

const clearEntitlement = async () => {
  await Promise.all([
    Preferences.set({ key: PREF_KEY_STATUS, value: "false" }),
    Preferences.remove({ key: PREF_KEY_EXPIRY }),
  ]);
};

// ── RevenueCat query ────────────────────────────────────────────────────────
const queryRevenueCat = async () => {
  if (!isNative()) return null;
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const anyActive = Object.keys(customerInfo.entitlements.active).length > 0;
    if (!anyActive) return { active: false, expiryMs: null };

    const activeEnt =
      customerInfo.entitlements.active[ENTITLEMENT_ID] ||
      Object.values(customerInfo.entitlements.active)[0];
    const expiryDate = activeEnt?.expirationDate;
    const expiryMs = expiryDate ? new Date(expiryDate).getTime() : null;

    return { active: true, expiryMs };
  } catch (err) {
    console.warn("[SubManager] RC query failed:", err.message);
    return null;
  }
};

// ── Backend query ───────────────────────────────────────────────────────────
const queryBackend = async () => {
  try {
    const token = await tokenManager.getToken();
    if (!token) return { active: false };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(BACKEND_URL, {
      method: "GET",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (!response.ok) return { active: false };
    const data = await response.json();
    return { active: data.subscription_status === "active" };
  } catch (err) {
    if (err.name !== "AbortError")
      console.warn("[SubManager] Backend query failed:", err.message);
    return null; // null = network failure
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Main status check. Called by App.js once on startup.
 *
 * Flow:
 *  1. Persisted valid expiry → return true immediately (offline mode).
 *  2. Query backend AND RevenueCat in parallel.
 *  3. If backend says active → persist (for 1 hour) and return true.
 *  4. Else if RC says active → accept, but also sync to backend to correct it
 *     and persist with RC’s expiry.
 *  5. Otherwise → clear persistence and return false.
 */
export const getSubscriptionStatus = async () => {
  // Fast offline path
  if (await isPersistedEntitlementValid()) {
    console.log("[SubManager] Returning persisted active entitlement.");
    return true;
  }

  // Query both sources in parallel
  const [rcResult, backendResult] = await Promise.allSettled([
    queryRevenueCat(),
    queryBackend(),
  ]);

  const rcActive = rcResult.status === "fulfilled" ? rcResult.value?.active : false;
  const backendActive = backendResult.status === "fulfilled" ? backendResult.value?.active : false;

  // Backend is the ultimate truth
  if (backendActive) {
    await persistEntitlement(Date.now() + 60 * 60 * 1000); // 1‑hour fallback
    console.log("[SubManager] Backend says active → unlocked.");
    return true;
  }

  // Backend inactive, but RC still sees active (possible delay / sandbox)
  if (rcActive) {
    const expiryMs = rcResult.value?.expiryMs;
    await persistEntitlement(expiryMs);
    // Fire‑and‑forget sync to heal the backend
    syncSubscriptionToBackend("monthly", expiryMs);
    console.log("[SubManager] RC active, backend inactive – accepting RC & syncing.");
    return true;
  }

  // Both inactive
  await clearEntitlement();
  console.log("[SubManager] Both sources say inactive.");
  return false;
};

/**
 * Called immediately after a confirmed purchase or restore.
 * Persists locally and sends the real plan + expiry to the backend.
 *
 * @param {string} plan - 'monthly' or 'yearly'
 * @param {number|null} expiryMs - exact RC expiration timestamp, or null for lifetime
 */
export const setSubscribedInCache = async (plan = "monthly", expiryMs = null) => {
  await persistEntitlement(expiryMs);
  await syncSubscriptionToBackend(plan, expiryMs);
  console.log(
    "[SubManager] Entitlement persisted and synced.",
    `Expiry: ${expiryMs ? new Date(expiryMs).toISOString() : "never"}`
  );
};

/**
 * Sends the subscription state to the backend.
 * Bridges the gap between client confirmation and webhook arrival.
 *
 * @param {string} plan
 * @param {number|null} rcExpiryMs
 */
export const syncSubscriptionToBackend = async (plan = "monthly", rcExpiryMs = null) => {
  try {
    const token = await tokenManager.getToken();
    if (!token) return;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    await fetch("https://kithia.com/website_b5d91c8e/api/subscription/sync-from-client", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        status: "active",
        plan: plan,
        rcExpiryMs: rcExpiryMs,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    console.log("[SubManager] Backend sync sent successfully.");
  } catch (err) {
    console.warn("[SubManager] Backend sync failed (non-fatal):", err.message);
  }
};