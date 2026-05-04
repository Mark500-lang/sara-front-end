import { useState, useEffect, useCallback } from "react";
import "./SubscriptionModal.css";
import { BsMoonStarsFill } from "react-icons/bs";
import { Modal, Button, Form, Spinner, Row, Col } from "react-bootstrap";
import { Purchases, LOG_LEVEL } from "@revenuecat/purchases-capacitor";
import { Capacitor } from "@capacitor/core";
import { getDeviceId } from "../utils/deviceIdentity";
import { setSubscribedInCache } from "../utils/subscriptionManager";

const RC_API_KEYS = {
  ios:     process.env.REACT_APP_REVENUECAT_IOS_API_KEY,
  android: process.env.REACT_APP_REVENUECAT_ANDROID_API_KEY,
};

const PRODUCT_IDS = {
  monthly: "com.littlestories.app.premiummonthlyrenewable",
  yearly:  "com.littlestories.app.premiumyearlyrenewable",
};

const ENTITLEMENT_ID = "Sara Stories Subscriptions";

const getPlatform = () => Capacitor.getPlatform();
const isNative    = () => Capacitor.isNativePlatform();

const SubscriptionModal = ({ show, onClose, onPaymentSuccess }) => {
  const [selectedPlan,       setSelectedPlan]       = useState("yearly");
  const [loading,            setLoading]            = useState(false);
  const [error,              setError]              = useState(null);
  const [purchaseInProgress, setPurchaseInProgress] = useState(false);
  const [initialized,        setInitialized]        = useState(false);
  const [restoring,          setRestoring]          = useState(false);
  const [networkStatus,      setNetworkStatus]      = useState(true);
  const [monthlyPrice,       setMonthlyPrice]       = useState("$4.99");
  const [yearlyPrice,        setYearlyPrice]        = useState("$34.99");

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

  const loadOfferings = async () => {
    try {
      const { current } = await Purchases.getOfferings();
      if (!current) return;
      for (const pkg of Object.values(current.availablePackages)) {
        const { identifier, priceString } = pkg.product;
        if (identifier === PRODUCT_IDS.monthly) setMonthlyPrice(priceString);
        if (identifier === PRODUCT_IDS.yearly)  setYearlyPrice(priceString);
      }
    } catch (err) {
      console.warn("[IAP] loadOfferings failed:", err.message);
    }
  };

  const initializeIAP = useCallback(async () => {
    if (!isNative()) {
      setInitialized(true);
      return;
    }
    try {
      const apiKey = getPlatform() === "android" ? RC_API_KEYS.android : RC_API_KEYS.ios;
      if (process.env.NODE_ENV !== "production") {
        await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
      }
      await Purchases.configure({ apiKey });
      const deviceId = await getDeviceId();
      if (deviceId) await Purchases.logIn({ appUserID: deviceId });
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

    const targetId = selectedPlan === "monthly" ? PRODUCT_IDS.monthly : PRODUCT_IDS.yearly;

    try {
      const { current } = await Purchases.getOfferings();
      if (!current) throw new Error("No products are currently available.");

      let packageToPurchase = null;
      for (const pkg of Object.values(current.availablePackages)) {
        if (pkg.product.identifier === targetId) {
          packageToPurchase = pkg;
          break;
        }
      }
      if (!packageToPurchase) {
        const fallback = Object.values(current.availablePackages)[0];
        if (fallback) packageToPurchase = fallback;
        else throw new Error("No products available for purchase.");
      }

      const { customerInfo } = await Purchases.purchasePackage({ aPackage: packageToPurchase });

      const activeEntitlements = Object.keys(customerInfo.entitlements.active);
      const hasPremium = !!customerInfo.entitlements.active[ENTITLEMENT_ID] || activeEntitlements.length > 0;

      if (hasPremium) {
        const activeEnt = customerInfo.entitlements.active[ENTITLEMENT_ID]
                       || Object.values(customerInfo.entitlements.active)[0];
        const expiryMs = activeEnt?.expirationDate ? new Date(activeEnt.expirationDate).getTime() : null;
        await setSubscribedInCache(selectedPlan, expiryMs);
        onPaymentSuccess();
        onClose();
      } else {
        throw new Error("Purchase completed but no active entitlement was found. Please tap Restore Purchases.");
      }
    } catch (err) {
      const msg  = (err.message || "").toLowerCase();
      const code = err.code;

      const userCancelled = msg.includes("cancelled") || msg.includes("canceled") || msg.includes("user cancel") || code === "1" || code === 1;

      const alreadyActive =
        msg.includes("already owned")      ||
        msg.includes("already active")     ||   // <-- NEW LINE
        msg.includes("already purchased")  ||
        msg.includes("already subscribed") ||
        msg.includes("item already")       ||
        err.code === "PRODUCT_ALREADY_PURCHASED" ||
        err.underlyingErrorMessage?.toLowerCase().includes("already");

      if (userCancelled) {
        setError(null);
      } else if (alreadyActive) {
        console.log("[IAP] Store says already active — fetching live customerInfo.");
        try {
          const customerInfo    = await Purchases.getCustomerInfo();
          const activeEnt       = customerInfo.entitlements.active[ENTITLEMENT_ID]
                               || Object.values(customerInfo.entitlements.active)[0];
          const activeCount     = Object.keys(customerInfo.entitlements.active).length;

          if (activeEnt || activeCount > 0) {
            let planFromEntitlement = selectedPlan;
            if (activeEnt?.productIdentifier) {
              if (activeEnt.productIdentifier.includes("monthly")) planFromEntitlement = "monthly";
              else if (activeEnt.productIdentifier.includes("yearly")) planFromEntitlement = "yearly";
            }
            const expiryMs = activeEnt?.expirationDate ? new Date(activeEnt.expirationDate).getTime() : null;
            await setSubscribedInCache(planFromEntitlement, expiryMs);
            onPaymentSuccess();
            onClose();
          } else {
            console.warn("[IAP] No entitlement found — applying 30-day fallback.");
            await setSubscribedInCache(selectedPlan, Date.now() + 30 * 24 * 60 * 60 * 1000);
            onPaymentSuccess();
            onClose();
          }
        } catch (infoErr) {
          console.warn("[IAP] getCustomerInfo failed during already-active handling:", infoErr.message);
          await setSubscribedInCache(selectedPlan, Date.now() + 30 * 24 * 60 * 60 * 1000);
          onPaymentSuccess();
          onClose();
        }
      } else if (msg.includes("network")) {
        setError("Network error. Please check your internet connection and try again.");
      } else {
        console.error("[IAP] Unhandled purchase error:", err);
        setError(`Purchase failed: ${err.message || "Unknown error"}`);
      }
    } finally {
      setLoading(false);
      setPurchaseInProgress(false);
    }
  };

  const restorePurchases = async () => {
    if (!isNative()) {
      setError("Restore is only available on iOS and Android.");
      return;
    }
    setRestoring(true);
    setError(null);
    try {
      const customerInfo = await Purchases.restorePurchases();
      const activeEntitlements = Object.keys(customerInfo.entitlements?.active ?? {});
      if (activeEntitlements.length > 0) {
        const restoredEnt = customerInfo.entitlements.active[ENTITLEMENT_ID]
                         || Object.values(customerInfo.entitlements.active)[0];
        let plan = "monthly";
        if (restoredEnt?.productIdentifier?.includes("yearly")) plan = "yearly";
        const expiryMs = restoredEnt?.expirationDate ? new Date(restoredEnt.expirationDate).getTime() : null;
        await setSubscribedInCache(plan, expiryMs);
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

  const getButtonText = () => {
    if (restoring)          return "Restoring...";
    if (purchaseInProgress) return "Processing...";
    if (loading)            return "Initializing...";
    return "Subscribe Now";
  };

  const isButtonDisabled = () => loading || purchaseInProgress || !initialized || restoring || !networkStatus;

  useEffect(() => {
    if (!show) { setError(null); setLoading(false); setPurchaseInProgress(false); setRestoring(false); }
  }, [show]);

  useEffect(() => {
    if (show && !initialized) initializeIAP();
  }, [show, initialized, initializeIAP]);

  return (
    <Modal show={show} onHide={onClose} fullscreen={true} dialogClassName="subscription-modal-fullscreen bg-transparent border-0" backdropClassName="custom-backdrop" centered scrollable={false}>
      <Modal.Header closeButton className="border-0 modal-header-fixed" />
      <Modal.Body className="d-flex flex-column justify-content-between align-items-center text-white modal-body-fullscreen">
        <h3 className="text-white w-100 text-center mt-3 mb-4">Subscribe to Sara Stories</h3>
        <ul className="list-unstyled text-center mb-4 benefits-list">
          <li><BsMoonStarsFill className="benefits-icon" /> Peaceful and restful sleep for your child</li>
          <li><BsMoonStarsFill className="benefits-icon" /> More than 3000 illustrations</li>
          <li><BsMoonStarsFill className="benefits-icon" /> Cancel anytime</li>
        </ul>
        <div className="flex-grow-1 d-flex flex-column justify-content-center w-100">
          <Row className="w-100 justify-content-center">
            <Col xs={12} md={8} lg={6}>
              <h5 className="mb-4 text-white text-center">Select Plan</h5>
              <div className={`plan-option mb-3 p-3 rounded d-flex align-items-center ${selectedPlan === "monthly" ? "selected" : ""}`} onClick={() => setSelectedPlan("monthly")} style={{ cursor: "pointer" }}>
                <Form.Check type="radio" id="monthly" name="plan" checked={selectedPlan === "monthly"} onChange={() => setSelectedPlan("monthly")} className="me-3 custom-radio" />
                <div className="d-flex flex-column flex-grow-1">
                  <span className="text-white fw-bold">Premium Monthly Subscription</span>
                  <div className="d-flex align-items-baseline"><span className="text-white fw-bold fs-4 me-1">{monthlyPrice}</span><span className="text-white-50 fs-6">/month</span></div>
                </div>
              </div>
              <div className={`plan-option mb-3 p-3 rounded d-flex align-items-center ${selectedPlan === "yearly" ? "selected" : ""}`} onClick={() => setSelectedPlan("yearly")} style={{ cursor: "pointer" }}>
                <Form.Check type="radio" id="yearly" name="plan" checked={selectedPlan === "yearly"} onChange={() => setSelectedPlan("yearly")} className="me-3 custom-radio" />
                <div className="d-flex flex-column flex-grow-1">
                  <span className="text-white fw-bold">Premium Yearly Subscription</span>
                  <div className="d-flex align-items-baseline"><span className="text-white fw-bold fs-4 me-1">{yearlyPrice}</span><span className="text-white-50 fs-6">/year</span></div>
                </div>
              </div>
              {!networkStatus && <div className="mt-3 text-center"><small className="text-warning">No internet connection</small></div>}
              {error && <div className="mt-3 p-2 rounded text-center error-message"><small className="text-warning">{error}</small></div>}
              <div className="mt-4 p-3 rounded text-center" style={{ background: "rgba(255,255,255,0.1)" }}>
                <small className="text-white-50">Payment processed securely through {getPlatform() === "android" ? "Google Play" : "Apple"}. Subscriptions auto-renew until cancelled in Settings.</small>
              </div>
            </Col>
          </Row>
        </div>
        <div className="w-100 text-center pb-4">
          <Button variant="warning" className="mt-4 w-75 fw-bold py-3 subscribe-button" onClick={handleSubscribe} disabled={isButtonDisabled()} size="lg">
            {(loading || purchaseInProgress || restoring) && <Spinner animation="border" size="sm" className="me-2" />}
            {getButtonText()}
          </Button>
          <div className="mt-3">
            <Button variant="outline-light" size="sm" onClick={restorePurchases} disabled={restoring || !initialized || !networkStatus} className="restore-button">
              {restoring && <Spinner animation="border" size="sm" className="me-2" />} Restore Purchases
            </Button>
          </div>
          <div className="mt-4 d-flex justify-content-center gap-4">
            <a href="https://www.privacypolicies.com/live/396845b8-e470-4bed-8cbb-5432ab867986" className="text-decoration-underline text-warning" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
            <a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/" className="text-decoration-underline text-warning" target="_blank" rel="noopener noreferrer">Terms of Use</a>
          </div>
          <div className="mt-3 text-center"><small className="text-white-50">Manage subscriptions in Settings</small></div>
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default SubscriptionModal;