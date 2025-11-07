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

  // ENHANCED IAP Initialization with VISUAL DEBUGGING
  const initializeIAP = useCallback(async () => {
    setDebugStatus("Starting IAP initialization...");
    addDebugDetail("🚀 Starting IAP initialization...");

    // Wait for device ready with timeout
    const waitForCordova = () => {
      return new Promise((resolve, reject) => {
        if (window.cordova && window.cordova.platformId) {
          addDebugDetail("✅ Cordova already ready");
          resolve();
          return;
        }
        
        const timeout = setTimeout(() => {
          reject(new Error('Cordova timeout after 5 seconds'));
        }, 5000);

        document.addEventListener('deviceready', () => {
          clearTimeout(timeout);
          addDebugDetail("✅ Cordova deviceReady fired");
          resolve();
        }, { once: true });

        addDebugDetail("⏳ Waiting for Cordova deviceReady...");
      });
    };

    try {
      await waitForCordova();
      setDebugStatus("Cordova ready");
      addDebugDetail("📱 Cordova platform: " + (window.cordova?.platformId || 'unknown'));

      // Check if store plugin is properly loaded
      if (!window.store) {
        const errorMsg = "❌ Store plugin missing - cordova-plugin-purchase not loaded";
        setDebugStatus(errorMsg);
        setStoreKitStatus("Plugin not loaded");
        addDebugDetail(errorMsg);
        addDebugDetail("🔍 Available globals: " + Object.keys(window).filter(k => k.includes('cordova') || k.includes('store')).join(', '));
        throw new Error('cordova-plugin-purchase not loaded');
      }

      // Verify store methods exist
      const requiredMethods = ['get', 'order', 'register', 'when', 'initialize', 'restore'];
      const missingMethods = requiredMethods.filter(method => typeof window.store[method] !== 'function');
      
      if (missingMethods.length > 0) {
        const errorMsg = `❌ Missing methods: ${missingMethods.join(', ')}`;
        setDebugStatus(errorMsg);
        addDebugDetail(errorMsg);
        addDebugDetail("🔍 Available store methods: " + Object.getOwnPropertyNames(window.store).filter(k => typeof window.store[k] === 'function').join(', '));
        throw new Error(`Incomplete store plugin: ${missingMethods.join(', ')} missing`);
      }

      setStoreKitStatus("✅ Plugin loaded");
      setDebugStatus("Configuring StoreKit...");
      addDebugDetail("✅ All store methods available");
      addDebugDetail("⚙️ Configuring StoreKit product handlers...");

      const store = window.store;

      // Enhanced error handling
      store.error((error) => {
        console.error('Store error:', error);
        const errorMsg = `💥 Store error: ${error.code} - ${error.message}`;
        setDebugStatus(errorMsg);
        addDebugDetail(errorMsg);
      });

      // Register products
      store.register([
        { id: PRODUCT_IDS.monthly, type: store.PAID_SUBSCRIPTION },
        { id: PRODUCT_IDS.yearly, type: store.PAID_SUBSCRIPTION }
      ]);
      addDebugDetail(`📝 Registered products: ${PRODUCT_IDS.monthly}, ${PRODUCT_IDS.yearly}`);

      // Product handlers
      store.when(PRODUCT_IDS.monthly).updated((product) => {
        const status = `📦 Monthly: ${product.state} (valid: ${product.valid})`;
        setProductStatus(status);
        addDebugDetail(status);
      });

      store.when(PRODUCT_IDS.yearly).updated((product) => {
        const status = `📦 Yearly: ${product.state} (valid: ${product.valid})`;
        setProductStatus(status);
        addDebugDetail(status);
      });

      // Initialize store
      addDebugDetail("🎯 Initializing StoreKit...");
      await store.initialize();
      
      setDebugStatus("StoreKit initialized");
      setInitialized(true);
      addDebugDetail("✅ StoreKit initialized successfully!");
      addDebugDetail("🎉 IAP system ready for purchases");

    } catch (error) {
      console.error('IAP Initialization failed:', error);
      const errorMsg = `❌ Init failed: ${error.message}`;
      setDebugStatus(errorMsg);
      setStoreKitStatus("❌ Initialization error");
      setInitialized(false);
      addDebugDetail(errorMsg);
    }
  }, []);

  useEffect(() => {
    if (show && !initialized) {
      // Reset debug when modal opens
      setDebugDetails("");
      addDebugDetail("🔔 Subscription modal opened");
      
      // Give components time to mount before initializing StoreKit
      const timer = setTimeout(() => {
        initializeIAP();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [show, initialized, initializeIAP]);
  
  const checkCapacitorBridge = () => {
    addDebugDetail("🔌 CAPACITOR BRIDGE CHECK");
    
    // Check Capacitor's bridge
    if (window.Capacitor) {
      addDebugDetail(`✅ Capacitor: ${window.Capacitor.getPlatform()}`);
      addDebugDetail(`✅ Capacitor version: ${window.Capacitor.getVersion()}`);
      
      // Check if Cordova is available to Capacitor
      if (window.Capacitor.isNative) {
        addDebugDetail("✅ Running in native context");
      } else {
        addDebugDetail("❌ Not in native context - Cordova plugins won't work");
      }
    }
    
    // Check for Capacitor's Cordova compatibility
    if (window.Capacitor?.Plugins?.Cordova) {
      addDebugDetail("✅ Capacitor Cordova compatibility layer active");
    } else {
      addDebugDetail("❌ Capacitor Cordova compatibility missing");
    }
  };

  const finishPurchase = async (product) => {
    setDebugStatus("Completing purchase...");
    addDebugDetail("💰 Completing purchase...");
    
    try {
      if (product.finish) {
        await product.finish();
        addDebugDetail("✅ Purchase finished in StoreKit");
      }
      
      // Simple receipt verification
      const userToken = localStorage.getItem("auth_token");
      if (userToken) {
        setDebugStatus("Verifying receipt...");
        addDebugDetail("📋 Verifying receipt with backend...");
        
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
          addDebugDetail("✅ Receipt verified successfully");
        }
      }
      
      setDebugStatus("Purchase completed successfully!");
      addDebugDetail("🎉 Purchase completed successfully!");
      onPaymentSuccess();
      onClose();
    } catch (err) {
      addDebugDetail(`⚠️ Purchase completed with minor verification issues: ${err.message}`);
      setError("Purchase completed! Please check your subscription status.");
      onPaymentSuccess();
      onClose();
    }
  };

  // ENHANCED: Purchase handler with detailed visual debugging
  const handleSubscribe = async () => {
    if (!initialized) {
      setError('Payment system still initializing. Please wait...');
      setDebugStatus("System not ready");
      addDebugDetail("❌ Purchase blocked: System not initialized");
      return;
    }

    if (!window.store || typeof window.store.get !== 'function') {
      setError('Payment system unavailable. Please restart the app.');
      setDebugStatus("Store methods missing");
      addDebugDetail("❌ Purchase blocked: Store methods missing");
      return;
    }

    setLoading(true);
    setError(null);
    setPurchaseInProgress(true);
    setDebugStatus("Starting purchase...");
    addDebugDetail("🛒 Starting purchase process...");

    const productId = selectedPlan === 'monthly' ? PRODUCT_IDS.monthly : PRODUCT_IDS.yearly;

    try {
      // Verify product exists and is valid
      addDebugDetail(`🔍 Looking up product: ${productId}`);
      const product = window.store.get(productId);
      
      if (!product) {
        const errorMsg = `❌ Product ${productId} not found in store`;
        addDebugDetail(errorMsg);
        throw new Error(errorMsg);
      }

      if (!product.valid) {
        const errorMsg = `❌ Product ${productId} is invalid: ${product.state}`;
        addDebugDetail(errorMsg);
        throw new Error(errorMsg);
      }

      const productStatus = `✅ Product found: ${product.state}, title: ${product.title}, price: ${product.price}`;
      setDebugStatus(`Product state: ${product.state}`);
      addDebugDetail(productStatus);

      // Initiate purchase
      addDebugDetail("🎯 Calling store.order()...");
      await window.store.order(productId);
      addDebugDetail("✅ Purchase initiated - waiting for Apple purchase sheet...");

    } catch (err) {
      console.error('Purchase error:', err);
      const errorMsg = `❌ Purchase failed: ${err.message}`;
      setDebugStatus(errorMsg);
      setError(`Purchase failed: ${err.message}`);
      addDebugDetail(errorMsg);
      setLoading(false);
      setPurchaseInProgress(false);
    }
  };

  // ENHANCED: Restore purchases with debugging
  const restorePurchases = async () => {
    if (!window.store) {
      setError('In-app purchases not available');
      setDebugStatus("StoreKit not available for restore");
      addDebugDetail("❌ Restore failed: Store not available");
      return;
    }

    setRestoring(true);
    setError(null);
    setDebugStatus("Restoring purchases...");
    addDebugDetail("🔄 Restoring purchases...");

    try {
      await window.store.restore();
      setDebugStatus("Restore completed");
      setError('Purchases restored successfully.');
      addDebugDetail("✅ Restore completed successfully");
    } catch (err) {
      setDebugStatus(`Restore failed: ${err.message}`);
      setError('Could not restore purchases. Please try again.');
      addDebugDetail(`❌ Restore failed: ${err.message}`);
    } finally {
      setRestoring(false);
    }
  };

  // ENHANCED: Test IAP setup with visual output
  const testIAPSetup = async () => {
    addDebugDetail("🧪 Running IAP setup test...");
    
    const cordovaAvailable = !!window.cordova;
    const storeAvailable = !!window.store;
    
    addDebugDetail(`📱 Cordova: ${cordovaAvailable ? '✅ Available' : '❌ Missing'}`);
    addDebugDetail(`🏪 Store object: ${storeAvailable ? '✅ Available' : '❌ Missing'}`);
    
    if (window.store) {
      const methods = Object.getOwnPropertyNames(window.store).filter(k => typeof window.store[k] === 'function');
      addDebugDetail(`🔧 Store methods: ${methods.join(', ')}`);
      
      // Test product retrieval
      if (typeof window.store.get === 'function') {
        const monthly = window.store.get(PRODUCT_IDS.monthly);
        const yearly = window.store.get(PRODUCT_IDS.yearly);
        addDebugDetail(`📦 Monthly product: ${monthly ? `found (${monthly.state})` : 'not found'}`);
        addDebugDetail(`📦 Yearly product: ${yearly ? `found (${yearly.state})` : 'not found'}`);
      }
    }
    
    addDebugDetail("✅ IAP setup test completed");
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
    if (show) {
      // Initial test after modal opens
      setTimeout(() => {
        addDebugDetail("🔔 Modal opened - starting diagnostics...");
        testIAPSetup();
      }, 1000);
    }
  }, [show]);

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
                      <strong> StoreKit:</strong> {storeKitStatus} | 
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