import { useState, useEffect, useCallback } from "react";
import "./SubscriptionModal.css";
import { BsMoonStarsFill } from "react-icons/bs";
import { Modal, Button, Form, Spinner, Row, Col } from "react-bootstrap";
import { Purchases, LOG_LEVEL } from "@revenuecat/purchases-capacitor";
import { Capacitor } from "@capacitor/core";
import { getDeviceId } from "../utils/deviceIdentity";
import { setSubscribedInCache, syncSubscriptionToBackend } from "../utils/subscriptionManager";

// ─── Config (sourced from .env) ───────────────────────────────────────────────
const RC_API_KEYS = {
  ios:     process.env.REACT_APP_REVENUECAT_IOS_API_KEY,
  android: process.env.REACT_APP_REVENUECAT_ANDROID_API_KEY,
};

const PRODUCT_IDS = {
  monthly: "com.littlestories.app.premiummonthlyrenewable",
  yearly:  "com.littlestories.app.premiumyearlyrenewable",
};

const ENTITLEMENT_ID = "Sara Stories Subscriptions";

// ─── Platform helpers ─────────────────────────────────────────────────────────
const getPlatform = () => Capacitor.getPlatform();      // "ios" | "android" | "web"
const isNative    = () => Capacitor.isNativePlatform(); // false in browser / dev

// ─── Component ────────────────────────────────────────────────────────────────
const SubscriptionModal = ({ show, onClose, onPaymentSuccess }) => {

  // ── State ──────────────────────────────────────────────────────────────
  const [selectedPlan,       setSelectedPlan]       = useState("yearly");
  const [loading,            setLoading]            = useState(false);
  const [error,              setError]              = useState(null);
  const [purchaseInProgress, setPurchaseInProgress] = useState(false);
  const [initialized,        setInitialized]        = useState(false);
  const [restoring,          setRestoring]          = useState(false);
  const [networkStatus,      setNetworkStatus]      = useState(true);

  // Real localised prices fetched from the store after init
  const [monthlyPrice, setMonthlyPrice] = useState("$4.99");
  const [yearlyPrice,  setYearlyPrice]  = useState("$34.99");

  // ── Network monitoring ─────────────────────────────────────────────────
  useEffect(() => {
    const up   = () => setNetworkStatus(true);
    const down = () => setNetworkStatus(false);

    window.addEventListener("online",  up);
    window.addEventListener("offline", down);
    setNetworkStatus(navigator.onLine);

    return () => {
      window.removeEventListener("online",  up);
      window.removeEventListener("offline", down);
    };
  }, []);

  // ── Load offerings → resolve real store prices ─────────────────────────
  const loadOfferings = async () => {
    try {
      const { current } = await Purchases.getOfferings();

      if (!current) {
        console.warn("[IAP] No current offering returned from RevenueCat.");
        return;
      }

      for (const pkg of Object.values(current.availablePackages)) {
        const { identifier, priceString } = pkg.product;
        if (identifier === PRODUCT_IDS.monthly) setMonthlyPrice(priceString);
        if (identifier === PRODUCT_IDS.yearly)  setYearlyPrice(priceString);
      }
    } catch (err) {
      console.warn("[IAP] loadOfferings failed:", err.message);
    }
  };

  // ── RevenueCat initialisation ──────────────────────────────────────────
  const initializeIAP = useCallback(async () => {
    if (!isNative()) {
      console.warn("[IAP] Non-native platform — skipping RevenueCat init.");
      setInitialized(true);
      return;
    }

    try {
      const apiKey = getPlatform() === "android"
        ? RC_API_KEYS.android
        : RC_API_KEYS.ios;

      if (process.env.NODE_ENV !== "production") {
        await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
      }

      await Purchases.configure({ apiKey });
      console.log("[IAP] RevenueCat configured for:", getPlatform());

      // Log the device UUID into RevenueCat as the App User ID.
      // This ties all purchases to this device permanently.
      // If the app is reinstalled, the same UUID is restored from SecureStorage,
      // so the user can always restore their purchases.
      const deviceId = await getDeviceId();
      if (deviceId) {
        await Purchases.logIn({ appUserID: deviceId });
        console.log("[IAP] RevenueCat logged in with device UUID:", deviceId);
      }

      await loadOfferings();

      const customerInfo = await Purchases.getCustomerInfo();
      if (Object.keys(customerInfo.entitlements.active).length > 0) {
        console.log("[IAP] User already has active entitlements on init.");
      }

      setInitialized(true);
    } catch (err) {
      console.error("[IAP] Initialization failed:", err);
      setInitialized(true);
    }
  }, []);

  // ── Purchase handler ───────────────────────────────────────────────────
  const handleSubscribe = async () => {

    if (!isNative()) {
      setError("In-app purchases are only available on iOS and Android.");
      return;
    }
    if (!initialized) {
      setError("Payment system is still initialising. Please wait a moment.");
      return;
    }
    if (!networkStatus) {
      setError("No internet connection. Please check your network and try again.");
      return;
    }

    setLoading(true);
    setError(null);
    setPurchaseInProgress(true);

    const targetId = selectedPlan === "monthly"
      ? PRODUCT_IDS.monthly
      : PRODUCT_IDS.yearly;

    try {
      // 1. Fetch current offerings
      const { current } = await Purchases.getOfferings();

      if (!current) {
        throw new Error("No products are currently available. Please try again later.");
      }

      // 2. Find the package matching our target product ID
      let packageToPurchase = null;

      for (const pkg of Object.values(current.availablePackages)) {
        if (pkg.product.identifier === targetId) {
          packageToPurchase = pkg;
          break;
        }
      }

      // 3. Graceful fallback
      if (!packageToPurchase) {
        const fallback = Object.values(current.availablePackages)[0];
        if (fallback) {
          console.warn(`[IAP] "${targetId}" not found. Falling back to "${fallback.product.identifier}".`);
          packageToPurchase = fallback;
        } else {
          throw new Error("No products available for purchase.");
        }
      }

      console.log(`[IAP] Purchasing: ${packageToPurchase.product.title} @ ${packageToPurchase.product.priceString}`);

      // 4. Trigger the native purchase sheet
      const { customerInfo } = await Purchases.purchasePackage({
        aPackage: packageToPurchase,
      });

      // 5. Entitlement check
      const activeEntitlements = Object.keys(customerInfo.entitlements.active);

      const hasPremium =
        !!customerInfo.entitlements.active[ENTITLEMENT_ID] ||
        activeEntitlements.length > 0;

      if (hasPremium) {
        console.log("[IAP] Purchase successful. Active entitlements:", activeEntitlements);

        // ── Update the subscriptionManager cache immediately so that the next
        //    call to getSubscriptionStatus() (on any re-mount of HomePage) reads
        //    true without waiting for a backend round-trip.
        //    This is the key fix for books re-locking on app reload. ───────────
        await setSubscribedInCache(true);

        // ── Fire-and-forget backend sync.
        //    The RevenueCat webhook may arrive at the backend seconds or minutes
        //    later — this call bridges that gap so the backend record is updated
        //    as soon as possible, without blocking the UI. ─────────────────────
        syncSubscriptionToBackend();

        onPaymentSuccess();
        onClose();
      } else {
        throw new Error(
          "Purchase completed but no active entitlement was found. Please tap Restore Purchases."
        );
      }

    } catch (err) {
      const msg  = err.message || "";
      const code = err.code;

      if (
        msg.toLowerCase().includes("cancelled") ||
        msg.toLowerCase().includes("canceled")  ||
        code === "1" || code === 1
      ) {
        // User tapped Cancel — not an error, dismiss silently
        setError(null);

      } else if (msg.toLowerCase().includes("already owned")) {
        // Android: Google Play returns "already owned" for active subscriptions.
        // Treat as success.
        console.log("[IAP] Product already owned — granting access.");

        await setSubscribedInCache(true);
        syncSubscriptionToBackend();

        onPaymentSuccess();
        onClose();

      } else if (msg.toLowerCase().includes("network")) {
        setError("Network error. Please check your internet connection and try again.");

      } else {
        setError(`Purchase failed: ${msg}`);
      }

    } finally {
      setLoading(false);
      setPurchaseInProgress(false);
    }
  };

  // ── Restore purchases ──────────────────────────────────────────────────
  const restorePurchases = async () => {

    if (!isNative()) {
      setError("Restore is only available on iOS and Android.");
      return;
    }

    setRestoring(true);
    setError(null);

    try {
      const customerInfo = await Purchases.restorePurchases();

      const activeEntitlements = Object.keys(
        customerInfo.entitlements?.active ?? {}
      );

      if (activeEntitlements.length > 0) {
        console.log("[IAP] Restore successful. Entitlements:", activeEntitlements);

        // ── Same cache + backend sync as purchase success path ───────────────
        await setSubscribedInCache(true);
        syncSubscriptionToBackend();

        onPaymentSuccess();
        onClose();
      } else {
        setError("No active purchases found for this account.");
      }

    } catch (err) {
      console.error("[IAP] Restore failed:", err);
      setError("Could not restore purchases. Please try again.");
    } finally {
      setRestoring(false);
    }
  };

  // ── UI helpers ─────────────────────────────────────────────────────────
  const getButtonText = () => {
    if (restoring)          return "Restoring...";
    if (purchaseInProgress) return "Processing...";
    if (loading)            return "Initializing...";
    return "Subscribe Now";
  };

  const isButtonDisabled = () =>
    loading || purchaseInProgress || !initialized || restoring || !networkStatus;

  // ── Lifecycle ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!show) {
      setError(null);
      setLoading(false);
      setPurchaseInProgress(false);
      setRestoring(false);
    }
  }, [show]);

  useEffect(() => {
    if (show && !initialized) {
      initializeIAP();
    }
  }, [show, initialized, initializeIAP]);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <Modal
      show={show}
      onHide={onClose}
      fullscreen={true}
      dialogClassName="subscription-modal-fullscreen bg-transparent border-0"
      backdropClassName="custom-backdrop"
      centered
      scrollable={false}
    >
      <Modal.Header closeButton className="border-0 modal-header-fixed" />

      <Modal.Body className="d-flex flex-column justify-content-between align-items-center text-white modal-body-fullscreen">

        <h3 className="text-white w-100 text-center mt-3 mb-4">
          Subscribe to Sara Stories
        </h3>

        <ul className="list-unstyled text-center mb-4 benefits-list">
          <li><BsMoonStarsFill className="benefits-icon" /> Peaceful and restful sleep for your child</li>
          <li><BsMoonStarsFill className="benefits-icon" /> More than 3000 illustrations</li>
          <li><BsMoonStarsFill className="benefits-icon" /> Cancel anytime</li>
        </ul>

        <div className="flex-grow-1 d-flex flex-column justify-content-center w-100">
          <Row className="w-100 justify-content-center">
            <Col xs={12} md={8} lg={6}>

              <h5 className="mb-4 text-white text-center">Select Plan</h5>

              {/* Monthly Plan */}
              <div
                className={`plan-option mb-3 p-3 rounded d-flex align-items-center ${selectedPlan === "monthly" ? "selected" : ""}`}
                onClick={() => setSelectedPlan("monthly")}
                style={{ cursor: "pointer" }}
              >
                <Form.Check
                  type="radio"
                  id="monthly"
                  name="plan"
                  checked={selectedPlan === "monthly"}
                  onChange={() => setSelectedPlan("monthly")}
                  className="me-3 custom-radio"
                />
                <div className="d-flex flex-column flex-grow-1">
                  <span className="text-white fw-bold">Premium Monthly Subscription</span>
                  <div className="d-flex align-items-baseline">
                    <span className="text-white fw-bold fs-4 me-1">{monthlyPrice}</span>
                    <span className="text-white-50 fs-6">/month</span>
                  </div>
                </div>
              </div>

              {/* Yearly Plan */}
              <div
                className={`plan-option mb-3 p-3 rounded d-flex align-items-center ${selectedPlan === "yearly" ? "selected" : ""}`}
                onClick={() => setSelectedPlan("yearly")}
                style={{ cursor: "pointer" }}
              >
                <Form.Check
                  type="radio"
                  id="yearly"
                  name="plan"
                  checked={selectedPlan === "yearly"}
                  onChange={() => setSelectedPlan("yearly")}
                  className="me-3 custom-radio"
                />
                <div className="d-flex flex-column flex-grow-1">
                  <span className="text-white fw-bold">Premium Yearly Subscription</span>
                  <div className="d-flex align-items-baseline">
                    <span className="text-white fw-bold fs-4 me-1">{yearlyPrice}</span>
                    <span className="text-white-50 fs-6">/year</span>
                  </div>
                </div>
              </div>

              {/* Network warning */}
              {!networkStatus && (
                <div className="mt-3 text-center">
                  <small className="text-warning">No internet connection</small>
                </div>
              )}

              {/* Error display */}
              {error && (
                <div className="mt-3 p-2 rounded text-center error-message">
                  <small className="text-warning">{error}</small>
                </div>
              )}

              <div className="mt-4 p-3 rounded text-center" style={{ background: "rgba(255,255,255,0.1)" }}>
                <small className="text-white-50">
                  Payment processed securely through{" "}
                  {getPlatform() === "android" ? "Google Play" : "Apple"}.
                  Subscriptions auto-renew until cancelled in Settings.
                </small>
              </div>

            </Col>
          </Row>
        </div>

        {/* CTA & footer */}
        <div className="w-100 text-center pb-4">

          <Button
            variant="warning"
            className="mt-4 w-75 fw-bold py-3 subscribe-button"
            onClick={handleSubscribe}
            disabled={isButtonDisabled()}
            size="lg"
          >
            {(loading || purchaseInProgress || restoring) && (
              <Spinner animation="border" size="sm" className="me-2" />
            )}
            {getButtonText()}
          </Button>

          <div className="mt-3">
            <Button
              variant="outline-light"
              size="sm"
              onClick={restorePurchases}
              disabled={restoring || !initialized || !networkStatus}
              className="restore-button"
            >
              {restoring && <Spinner animation="border" size="sm" className="me-2" />}
              Restore Purchases
            </Button>
          </div>

          <div className="mt-4 d-flex justify-content-center gap-4">
            <a
              href="https://www.privacypolicies.com/live/396845b8-e470-4bed-8cbb-5432ab867986"
              className="text-decoration-underline text-warning"
              target="_blank"
              rel="noopener noreferrer"
            >
              Privacy Policy
            </a>
            <a
              href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"
              className="text-decoration-underline text-warning"
              target="_blank"
              rel="noopener noreferrer"
            >
              Terms of Use
            </a>
          </div>

          <div className="mt-3 text-center">
            <small className="text-white-50">Manage subscriptions in Settings</small>
          </div>

        </div>
      </Modal.Body>
    </Modal>
  );
};

export default SubscriptionModal;