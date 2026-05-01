// subscriptionManager.js
// Single source of truth for subscription status.
// Priority: RevenueCat (native) → backend → false

import { Purchases } from "@revenuecat/purchases-capacitor";
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { tokenManager } from "./tokenManager";

const ENTITLEMENT_ID = "Sara Stories Subscriptions";
const CACHE_KEY = "subscription_status_cache";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — short enough to catch lapses

const isNative = () => Capacitor.isNativePlatform();

/**
 * Check RevenueCat directly (native only).
 * Returns true if the entitlement is active.
 */
const checkRevenueCat = async () => {
  if (!isNative()) return null; // null = "unknown, not applicable"

  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const active = Object.keys(customerInfo.entitlements.active);

    const hasPremium =
      !!customerInfo.entitlements.active[ENTITLEMENT_ID] ||
      active.length > 0;

    console.log("[SubManager] RevenueCat check:", hasPremium, "active:", active);
    return hasPremium;
  } catch (err) {
    console.warn("[SubManager] RevenueCat check failed:", err.message);
    return null; // null = "couldn't determine"
  }
};

/**
 * Check backend as a fallback.
 * Returns true/false or null on network failure.
 */
const checkBackend = async () => {
  try {
    const token = await tokenManager.getToken();
    if (!token) return false;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(
      "https://kithia.com/website_b5d91c8e/api/user/subscription-status",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      }
    ).finally(() => clearTimeout(timer));

    if (!response.ok) return false;

    const data = await response.json();
    return data.subscription_status === "active";
  } catch (err) {
    if (err.name !== "AbortError") {
      console.warn("[SubManager] Backend check failed:", err.message);
    }
    return null; // null = network failure, don't override cache
  }
};

/**
 * Write result to short-lived cache.
 */
const writeCache = async (value) => {
  await Preferences.set({
    key: CACHE_KEY,
    value: JSON.stringify({ subscribed: value, ts: Date.now() }),
  });
};

/**
 * Read cache. Returns null if missing or expired.
 */
const readCache = async () => {
  try {
    const raw = await Preferences.get({ key: CACHE_KEY });
    if (!raw.value) return null;
    const parsed = JSON.parse(raw.value);
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed.subscribed; // true or false
  } catch {
    return null;
  }
};

/**
 * Main entry point. Call this from HomePage on mount.
 *
 * Strategy:
 *   1. RevenueCat (native only) — most authoritative
 *   2. Backend — fallback for Android/web or if RC fails
 *   3. Short-lived cache — fallback if both network calls fail
 *   4. false — safe default, never falsely grant access
 */
export const getSubscriptionStatus = async () => {
  // 1. RevenueCat — always try this first on native
  const rcResult = await checkRevenueCat();
  if (rcResult !== null) {
    await writeCache(rcResult);
    return rcResult;
  }

  // 2. Backend fallback (also handles web/dev builds)
  const backendResult = await checkBackend();
  if (backendResult !== null) {
    await writeCache(backendResult);
    return backendResult;
  }

  // 3. Cache fallback — network is down
  const cached = await readCache();
  if (cached !== null) {
    console.warn("[SubManager] Both checks failed — using cache:", cached);
    return cached;
  }

  // 4. Safe default
  console.warn("[SubManager] No subscription data available — defaulting to false");
  return false;
};

/**
 * Call this immediately after a successful purchase/restore
 * so the cache reflects the new state without waiting for the next check.
 */
export const setSubscribedInCache = async (value) => {
  await writeCache(value);
};

/**
 * Sync backend after RevenueCat confirms a purchase.
 * Fire-and-forget — don't block the UI on this.
 */
export const syncSubscriptionToBackend = async () => {
  try {
    const token = await tokenManager.getToken();
    if (!token) return;

    await fetch(
      "https://kithia.com/website_b5d91c8e/api/subscription/sync-from-client",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "active" }),
      }
    );
    console.log("[SubManager] Backend sync sent.");
  } catch (err) {
    console.warn("[SubManager] Backend sync failed (non-fatal):", err.message);
  }
};