import { Capacitor } from "@capacitor/core";

// Checks HMS Core availability — NOT just brand name.
// Some Huawei devices have GMS; this distinguishes correctly.
export const isHuaweiHMS = async () => {
  if (!Capacitor.isNativePlatform()) return false;
  if (Capacitor.getPlatform() !== "android") return false;

  try {
    // The HMS IAP plugin throws if HMS Core is unavailable
    const result = await HMSInAppPurchases.isEnvReady();
    return result?.status?.statusCode === 0;
  } catch {
    return false;
  }
};