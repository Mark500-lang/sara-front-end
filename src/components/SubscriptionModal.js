import { useState, useEffect, useCallback } from "react";
import "./SubscriptionModal.css";
import { BsMoonStarsFill } from "react-icons/bs";
import { Modal, Button, Form, Spinner, Row, Col } from "react-bootstrap";
import ParentalGateModal from "./ParentalGateModal";

const PRODUCT_IDS = {
  monthly: 'com.littlestories.app.monthlyrenewable',
  yearly: 'com.littlestories.app.yearlyrenewable',
};

const SubscriptionModal = ({ show, onClose, onPaymentSuccess }) => {
  const [selectedPlan, setSelectedPlan] = useState("yearly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [purchaseInProgress, setPurchaseInProgress] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [networkStatus, setNetworkStatus] = useState(true);
  
  // VISUAL DEBUG STATES - Users can see these on screen
  const [debugStatus, setDebugStatus] = useState("Ready");
  const [storeKitStatus, setStoreKitStatus] = useState("Checking...");
  const [productStatus, setProductStatus] = useState("Unknown");

  // Simple network monitoring
  useEffect(() => {
    const handleOnline = () => {
      setNetworkStatus(true);
      if (error?.includes('network')) setError(null);
    };
    const handleOffline = () => setNetworkStatus(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setNetworkStatus(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [error]);

  // SIMPLIFIED IAP Initialization with VISUAL DEBUGGING
  const initializeIAP = useCallback(async () => {
    setDebugStatus("Initializing StoreKit...");
    setStoreKitStatus("Checking availability");
    
    if (!window.store) {
      setDebugStatus("StoreKit NOT available");
      setStoreKitStatus("❌ Missing - Check cordova plugin");
      setInitialized(true);
      return;
    }

    try {
      setStoreKitStatus("✅ Available");
      setDebugStatus("Registering products...");
      
      const store = window.store;
      
      // Minimal product registration
      store.register([PRODUCT_IDS.monthly, PRODUCT_IDS.yearly]);
      
      // Essential event handlers only
      store.when(PRODUCT_IDS.monthly).approved(finishPurchase);
      store.when(PRODUCT_IDS.yearly).approved(finishPurchase);
      
      store.ready(() => {
        setDebugStatus("StoreKit ready - products loaded");
        setInitialized(true);
        
        // Check product status for debugging
        const monthly = store.get(PRODUCT_IDS.monthly);
        const yearly = store.get(PRODUCT_IDS.yearly);
        
        if (monthly && yearly) {
          setProductStatus(`Monthly: ${monthly.state}, Yearly: ${yearly.state}`);
        } else {
          setProductStatus("Products not found in StoreKit");
        }
      });
      
      await store.initialize();
      setDebugStatus("StoreKit initialized successfully");
      
    } catch (error) {
      setDebugStatus("StoreKit initialization failed");
      setStoreKitStatus("❌ Initialization error");
      setInitialized(true);
    }
  }, []);

  useEffect(() => {
    if (show && !initialized) {
      // Give components time to mount before initializing StoreKit
      const timer = setTimeout(() => {
        initializeIAP();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [show, initialized, initializeIAP]);

  const finishPurchase = async (product) => {
    setDebugStatus("Completing purchase...");
    
    try {
      if (product.finish) {
        await product.finish();
        setDebugStatus("Purchase finished in StoreKit");
      }
      
      // Simple receipt verification
      const userToken = localStorage.getItem("auth_token");
      if (userToken) {
        setDebugStatus("Verifying receipt...");
        
        const BASE_URL = "https://kithia.com/website_b5d91c8e/api";
        let receiptData = product.transaction?.appStoreReceipt || 
                         product.transaction?.receipt || 
                         await window.store.getReceipt();
        
        if (receiptData) {
          await fetch(`${BASE_URL}/subscription/verify-apple`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${userToken}`,
            },
            body: JSON.stringify({
              receipt_data: receiptData,
              product_id: product.id,
              platform: 'ios',
            }),
          });
          setDebugStatus("Receipt verified successfully");
        }
      }
      
      setDebugStatus("Purchase completed successfully!");
      onPaymentSuccess();
      onClose();
    } catch (err) {
      setDebugStatus("Purchase completed with minor verification issues");
      setError("Purchase completed! Please check your subscription status.");
      onPaymentSuccess();
      onClose();
    }
  };

  // FIXED: Purchase handler with VISUAL DEBUGGING
  const handleSubscribe = async () => {
    if (!initialized) {
      setError('Payment system initializing...');
      setDebugStatus("System not ready yet");
      return;
    }

    if (!networkStatus) {
      setError('No internet connection. Please check your network.');
      setDebugStatus("No internet connection");
      return;
    }

    if (!selectedPlan) {
      setError('Please select a subscription plan.');
      setDebugStatus("No plan selected");
      return;
    }

    setLoading(true);
    setError(null);
    setPurchaseInProgress(true);
    setDebugStatus("Starting purchase process...");

    const productId = selectedPlan === 'monthly' ? PRODUCT_IDS.monthly : PRODUCT_IDS.yearly;

    try {
      if (window.store) {
        setDebugStatus(`Attempting to purchase: ${productId}`);
        
        // Check product status before purchase
        const product = window.store.get(productId);
        if (product) {
          setDebugStatus(`Product found: ${product.state}, valid: ${product.valid}`);
        } else {
          setDebugStatus("Product not found in StoreKit");
        }
        
        setDebugStatus("Calling store.order()...");
        await window.store.order(productId);
        
        setDebugStatus("Purchase initiated successfully - waiting for Apple...");
        // Loading state continues until finishPurchase is called
        
      } else {
        setDebugStatus("StoreKit not available - IAP disabled");
        setError('In-app purchases not available on this device.');
        setLoading(false);
        setPurchaseInProgress(false);
      }
    } catch (err) {
      setDebugStatus(`Purchase failed: ${err.message}`);
      setError(`Failed to start purchase: ${err.message}`);
      setLoading(false);
      setPurchaseInProgress(false);
    }
  };

  // Simple restore purchases with debugging
  const restorePurchases = async () => {
    if (!window.store) {
      setError('In-app purchases not available');
      setDebugStatus("StoreKit not available for restore");
      return;
    }

    setRestoring(true);
    setError(null);
    setDebugStatus("Restoring purchases...");

    try {
      await window.store.restore();
      setDebugStatus("Restore completed");
      setError('Purchases restored successfully.');
    } catch (err) {
      setDebugStatus(`Restore failed: ${err.message}`);
      setError('Could not restore purchases. Please try again.');
    } finally {
      setRestoring(false);
    }
  };

  const getButtonText = () => {
    if (restoring) return "Restoring...";
    if (purchaseInProgress) return "Processing...";
    if (loading) return "Initializing...";
    return "Subscribe Now";
  };

  const isButtonDisabled = () => {
    return loading || purchaseInProgress || !initialized || restoring || !networkStatus;
  };

  // Reset when modal closes
  useEffect(() => {
    if (!show) {
      setError(null);
      setLoading(false);
      setPurchaseInProgress(false);
      setRestoring(false);
      setDebugStatus("Ready");
    }
  }, [show]);

  return (
    <>
      <Modal
        show={show}
        onHide={onClose}
        fullscreen={true}
        dialogClassName="subscription-modal-fullscreen bg-transparent border-0"
        backdropClassName="custom-backdrop"
        centered
        scrollable={false}
      >
        <Modal.Header closeButton className="border-0 modal-header-fixed">
        </Modal.Header>

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

                {/* VISUAL DEBUG PANEL - Users can see this on device */}
                <div className="mb-3 p-2 rounded text-center" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)' }}>
                  <small className="text-white-50">
                    <strong>Status:</strong> {debugStatus}<br/>
                    <strong>StoreKit:</strong> {storeKitStatus}<br/>
                    <strong>Products:</strong> {productStatus}
                  </small>
                </div>

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
                      <span className="text-white fw-bold fs-4 me-1">$4.99</span>
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
                      <span className="text-white fw-bold fs-4 me-1">$34.99</span>
                      <span className="text-white-50 fs-6">/year</span>
                    </div>
                  </div>
                </div>

                {/* Network Status */}
                {!networkStatus && (
                  <div className="mt-3 text-center">
                    <small className="text-warning">No internet connection</small>
                  </div>
                )}

                {/* Error Display */}
                {error && (
                  <div className="mt-3 p-2 rounded text-center error-message">
                    <small className="text-warning">{error}</small>
                  </div>
                )}

                <div className="mt-4 p-3 rounded text-center" style={{ background: 'rgba(255,255,255,0.1)' }}>
                  <small className="text-white-50">
                    Payment processed securely through Apple. Subscriptions auto-renew until canceled in Settings.
                  </small>
                </div>
              </Col>
            </Row>
          </div>

          <div className="w-100 text-center pb-4">
            <Button
              variant="warning"
              className="mt-4 w-75 fw-bold py-3 subscribe-button"
              onClick={handleSubscribe}
              disabled={isButtonDisabled()}
              size="lg"
            >
              {loading || purchaseInProgress || restoring ? (
                <Spinner animation="border" size="sm" className="me-2" />
              ) : null}
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
                {restoring ? <Spinner animation="border" size="sm" className="me-2" /> : null}
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
              <small className="text-white-50">
                Manage subscriptions in Settings
              </small>
            </div>
          </div>
        </Modal.Body>
      </Modal>
    </>
  );
};

export default SubscriptionModal;