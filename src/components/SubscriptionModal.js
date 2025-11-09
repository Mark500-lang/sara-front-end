import { useState, useEffect, useCallback } from "react";
import "./SubscriptionModal.css";
import { BsMoonStarsFill } from "react-icons/bs";
import { Modal, Button, Form, Spinner, Row, Col } from "react-bootstrap";
import ParentalGateModal from "./ParentalGateModal";
import { Purchases } from '@revenuecat/purchases-capacitor';

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
  
  // ENHANCED VISUAL DEBUG STATES
  const [debugStatus, setDebugStatus] = useState("Ready");
  const [storeKitStatus, setStoreKitStatus] = useState("Checking...");
  const [productStatus, setProductStatus] = useState("Unknown");
  const [debugDetails, setDebugDetails] = useState(""); // New: For detailed debug info

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

  // ENHANCED: Debug logging that shows on screen
  const addDebugDetail = (message) => {
    setDebugDetails(prev => {
      const timestamp = new Date().toLocaleTimeString();
      const newMessage = `[${timestamp}] ${message}\n`;
      // Keep last 10 debug messages to avoid overflow
      const lines = (prev + newMessage).split('\n');
      if (lines.length > 10) {
        return lines.slice(-10).join('\n');
      }
      return prev + newMessage;
    });
  };

  // REVENUECAT IAP Initialization with VISUAL DEBUGGING
  const initializeIAP = useCallback(async () => {
    setDebugStatus("Initializing RevenueCat Purchases...");
    addDebugDetail("🚀 Initializing @revenuecat/purchases-capacitor");

    try {
      // Configure RevenueCat
      await Purchases.configure({
        apiKey: "appl_xxx" // Replace with your RevenueCat API key
      });
      
      addDebugDetail("✅ RevenueCat configured");
      
      // Load offerings (products)
      const offerings = await Purchases.getOfferings();
      
      if (offerings.current) {
        addDebugDetail(`✅ Offerings loaded: ${Object.keys(offerings.current.availablePackages).length} packages`);
        
        // Log available products for debugging
        Object.values(offerings.current.availablePackages).forEach(pkg => {
          addDebugDetail(`📦 ${pkg.product.identifier}: ${pkg.product.title} - ${pkg.product.priceString}`);
        });
        
        setProductStatus("Products loaded");
      } else {
        addDebugDetail("⚠️ No current offerings available");
      }
      
      setInitialized(true);
      setStoreKitStatus("✅ Ready");
      setDebugStatus("Purchases ready");
      addDebugDetail("🎉 RevenueCat Purchases initialized successfully");

    } catch (error) {
      addDebugDetail(`❌ RevenueCat init failed: ${error.message}`);
      setDebugStatus(`Init failed: ${error.message}`);
      setStoreKitStatus("❌ Failed");
    }
  }, []);

  // REVENUECAT: Purchase handler with detailed visual debugging
  const handleSubscribe = async () => {
    if (!initialized) {
      setError('Payment system still initializing. Please wait...');
      setDebugStatus("System not ready");
      addDebugDetail("❌ Purchase blocked: System not initialized");
      return;
    }

    setLoading(true);
    setError(null);
    setPurchaseInProgress(true);
    setDebugStatus("Starting purchase...");
    addDebugDetail("🛒 Starting purchase process...");

    const productId = selectedPlan === 'monthly' ? PRODUCT_IDS.monthly : PRODUCT_IDS.yearly;

    try {
      addDebugDetail(`🔍 Looking for product: ${productId}`);
      
      // Get current offerings
      const offerings = await Purchases.getOfferings();
      
      if (!offerings.current) {
        throw new Error('No products available');
      }

      // Find the package for our product
      let packageToPurchase = null;
      
      // Check all available packages for our product ID
      for (const packageKey in offerings.current.availablePackages) {
        const pkg = offerings.current.availablePackages[packageKey];
        if (pkg.product.identifier === productId) {
          packageToPurchase = pkg;
          break;
        }
      }

      if (!packageToPurchase) {
        // Fallback: use first available package
        const firstPackageKey = Object.keys(offerings.current.availablePackages)[0];
        if (firstPackageKey) {
          packageToPurchase = offerings.current.availablePackages[firstPackageKey];
          addDebugDetail(`⚠️ Exact product not found, using: ${packageToPurchase.product.identifier}`);
        } else {
          throw new Error('No products available for purchase');
        }
      }

      addDebugDetail(`🎯 Purchasing: ${packageToPurchase.product.title} - ${packageToPurchase.product.priceString}`);

      // Make purchase
      const purchaseResult = await Purchases.purchasePackage(packageToPurchase);
      
      addDebugDetail("✅ Purchase completed, checking entitlements...");
      
      // Check if purchase was successful
      if (purchaseResult.customerInfo.entitlements.active.premium) {
        addDebugDetail("🎉 Purchase successful! Premium access granted");
        onPaymentSuccess();
        onClose();
      } else {
        // Check for any active entitlement
        const activeEntitlements = Object.keys(purchaseResult.customerInfo.entitlements.active);
        if (activeEntitlements.length > 0) {
          addDebugDetail(`🎉 Purchase successful! Active entitlements: ${activeEntitlements.join(', ')}`);
          onPaymentSuccess();
          onClose();
        } else {
          throw new Error('Purchase completed but no active entitlements');
        }
      }
      
    } catch (error) {
      // Check if user cancelled
      if (error.message.includes('User cancelled') || error.message.includes('cancelled') || error.code === '1') {
        addDebugDetail("ℹ️ Purchase cancelled by user");
        setError('Purchase cancelled');
      } else {
        addDebugDetail(`❌ Purchase failed: ${error.message}`);
        setError(`Purchase failed: ${error.message}`);
      }
      setLoading(false);
      setPurchaseInProgress(false);
    }
  };

  // REVENUECAT: Restore purchases with debugging
  const restorePurchases = async () => {
    setRestoring(true);
    setError(null);
    setDebugStatus("Restoring purchases...");
    addDebugDetail("🔄 Restoring purchases...");

    try {
      const customerInfo = await Purchases.restorePurchases();
      
      // Check for any active entitlement
      const activeEntitlements = Object.keys(customerInfo.entitlements.active);
      
      if (activeEntitlements.length > 0) {
        addDebugDetail(`✅ Purchases restored - active entitlements: ${activeEntitlements.join(', ')}`);
        setError('Purchases restored successfully!');
        onPaymentSuccess();
        onClose();
      } else {
        addDebugDetail("ℹ️ No active purchases found");
        setError('No active purchases found');
      }
    } catch (error) {
      addDebugDetail(`❌ Restore failed: ${error.message}`);
      setError('Could not restore purchases. Please try again.');
    } finally {
      setRestoring(false);
    }
  };

  // REVENUECAT: Test IAP setup with visual output
  const testIAPSetup = async () => {
    addDebugDetail("🧪 Running RevenueCat setup test...");
    
    try {
      const offerings = await Purchases.getOfferings();
      const revenueCatAvailable = !!offerings;
      
      addDebugDetail(`💰 RevenueCat: ${revenueCatAvailable ? '✅ Available' : '❌ Missing'}`);
      
      if (offerings.current) {
        const packageCount = Object.keys(offerings.current.availablePackages).length;
        addDebugDetail(`📦 Available packages: ${packageCount}`);
        
        Object.values(offerings.current.availablePackages).forEach(pkg => {
          addDebugDetail(`   ${pkg.product.identifier}: ${pkg.product.title}`);
        });
      }
    } catch (error) {
      addDebugDetail(`❌ RevenueCat test failed: ${error.message}`);
    }
    
    addDebugDetail("✅ RevenueCat setup test completed");
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

  // Call test when modal opens and after initialization
  useEffect(() => {
    if (show && !initialized) {
      setDebugDetails("");
      addDebugDetail("🔔 Modal opened - starting RevenueCat diagnostics...");
      initializeIAP();
    }
  }, [show, initialized, initializeIAP]);

  useEffect(() => {
    if (initialized) {
      addDebugDetail("🎉 System initialized - running final checks...");
      testIAPSetup();
    }
  }, [initialized]);

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

                {/* ENHANCED VISUAL DEBUG PANEL */}
                <div className="mb-3 p-2 rounded text-center" style={{ 
                  background: 'rgba(255,255,255,0.1)', 
                  border: '1px solid rgba(255,255,255,0.3)',
                  maxHeight: '150px',
                  overflowY: 'auto',
                  fontSize: '15px',
                  textAlign: 'left',
                  padding: '8px'
                }}>
                  <div className="text-center mb-1">
                    <small className="text-white-50">
                      <strong>Status:</strong> {debugStatus} | 
                      <strong> RevenueCat:</strong> {storeKitStatus} | 
                      <strong> Products:</strong> {productStatus}
                    </small>
                  </div>
                  <hr className="my-1" style={{ borderColor: 'rgba(255,255,255,0.2)' }} />
                  <pre className="text-white-50 mb-0" style={{ 
                    fontSize: '12px', 
                    lineHeight: '1.2',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    margin: 0
                  }}>
                    {debugDetails || "Debug information will appear here..."}
                  </pre>
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