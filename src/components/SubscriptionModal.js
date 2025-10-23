import { useState, useEffect } from "react";
import "./SubscriptionModal.css";
import { BsMoonStarsFill } from "react-icons/bs";
import { Modal, Button, Form, Spinner, Alert, Row, Col } from "react-bootstrap";
import ParentalGateModal from "./ParentalGateModal";

// Initialize the purchase plugin
let InAppPurchase = null;

// Wait for Cordova to be ready (for Capacitor apps)
const waitForCordova = () => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(null);
      return;
    }

    // Check if already available
    if (window.store) {
      resolve(window.store);
      return;
    }

    // In Capacitor, Cordova plugins load automatically
    // Wait for deviceready event or check periodically
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      // Give it a moment to load
      setTimeout(() => {
        resolve(window.store || null);
      }, 1000);
    } else {
      document.addEventListener('deviceready', () => {
        setTimeout(() => {
          resolve(window.store || null);
        }, 500);
      }, { once: true });
      
      // Fallback timeout
      setTimeout(() => {
        resolve(window.store || null);
      }, 3000);
    }
  });
};

const SubscriptionModal = ({ show, onClose, onPaymentSuccess }) => {
  const [selectedPlan, setSelectedPlan] = useState("yearly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [products, setProducts] = useState([]);
  const [purchaseInProgress, setPurchaseInProgress] = useState(false);
  const [initialized, setInitialized] = useState(false);
  
  // Parental Gate States
  const [showParentalGate, setShowParentalGate] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  const PRODUCT_IDS = {
    monthly: 'com.sarastories.app.monthly',
    yearly: 'com.sarastories.app.yearly'
  };

  const FALLBACK_PRICES = {
    monthly: '$4.99/month',
    yearly: '$34.99/year'
  };

  const FALLBACK_TITLES = {
    monthly: 'Monthly Subscription',
    yearly: 'Yearly Subscription'
  };

  // Enhanced error handler
  const handleIAPError = (error) => {
    console.error('IAP Error:', error);
    const errorMessage = error?.message || 'Unknown error occurred';
    
    // User-friendly error messages
    if (errorMessage.includes('cancelled') || errorMessage.includes('user cancelled')) {
      setError('Purchase was cancelled');
    } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
      setError('Network error. Please check your connection and try again.');
    } else {
      setError('Purchase failed. Please try again.');
    }
    
    setPurchaseInProgress(false);
    setLoading(false);
  };

  // Debug function to check environment
  const debugEnvironment = () => {
    console.log('=== IAP ENVIRONMENT DEBUG ===');
    console.log('window.store:', window.store);
    console.log('window.cordova:', window.cordova);
    console.log('window.Capacitor:', window.Capacitor);
    console.log('document.readyState:', document.readyState);
    console.log('User Agent:', navigator.userAgent);
    console.log('Platform:', navigator.platform);
    console.log('=============================');
  };

  useEffect(() => {
    if (show && !initialized) {
      debugEnvironment(); // Debug info
      initializeIAP();
    }
  }, [show, initialized]);

  // Parental Gate Handlers
  const handlePrivacyPolicyClick = (e) => {
    e.preventDefault();
    setPendingAction(() => () => {
      window.open('https://www.privacypolicies.com/live/396845b8-e470-4bed-8cbb-5432ab867986', '_blank');
    });
    setShowParentalGate(true);
  };

  const handleParentalGateSuccess = () => {
    if (pendingAction) {
      pendingAction();
    }
    setPendingAction(null);
  };

  const handleParentalGateClose = () => {
    setShowParentalGate(false);
    setPendingAction(null);
  };

  const initializeIAP = async () => {
    try {
      console.log('Initializing In-App Purchase...');
      setLoading(true);
      
      // Wait for Cordova to be ready
      InAppPurchase = await waitForCordova();
      
      if (!InAppPurchase) {
        console.error('Cordova Purchase plugin not available after waiting');
        setError('In-app purchases not supported in this environment. Please ensure you are using the app on a supported iOS device.');
        setInitialized(true);
        setLoading(false);
        return;
      }

      console.log('Cordova Purchase plugin found:', InAppPurchase);

      // Configure the plugin
      InAppPurchase.verbosity = InAppPurchase.DEBUG; // Use DEBUG for testing
      
      // Register products
      try {
        await InAppPurchase.register([
          {
            id: PRODUCT_IDS.monthly,
            type: InAppPurchase.PAID_SUBSCRIPTION
          },
          {
            id: PRODUCT_IDS.yearly,
            type: InAppPurchase.PAID_SUBSCRIPTION
          }
        ]);
        console.log('Products registered successfully');
      } catch (registerError) {
        console.error('Product registration failed:', registerError);
        throw new Error('Failed to register subscription products');
      }

      // Set up event handlers
      InAppPurchase.when("product")
        .updated((product) => {
          console.log('Product updated:', product.id, product.valid ? 'VALID' : 'INVALID');
          updateProductsList();
        });

      InAppPurchase.when(PRODUCT_IDS.monthly)
        .approved((product) => {
          console.log('Monthly subscription approved:', product);
          finishPurchase(product);
        });
        
      InAppPurchase.when(PRODUCT_IDS.yearly)
        .approved((product) => {
          console.log('Yearly subscription approved:', product);
          finishPurchase(product);
        });

      InAppPurchase.when("error").then((error) => {
        console.error('IAP Error event:', error);
        handleIAPError(error);
      });

      // Refresh to load product details
      try {
        await InAppPurchase.refresh();
        console.log('IAP refresh completed');
      } catch (refreshError) {
        console.warn('IAP refresh had issues:', refreshError);
        // Continue anyway - products might still load via events
      }
      
      setInitialized(true);
      setLoading(false);
      console.log('IAP initialized successfully');

    } catch (err) {
      console.error('IAP Initialization error:', err);
      setError(`Failed to initialize in-app purchases: ${err.message}`);
      setInitialized(true);
      setLoading(false);
    }
  };

  const updateProductsList = () => {
    try {
      const monthlyProduct = InAppPurchase.get(PRODUCT_IDS.monthly);
      const yearlyProduct = InAppPurchase.get(PRODUCT_IDS.yearly);
      
      const availableProducts = [monthlyProduct, yearlyProduct].filter(p => p && p.valid);
      setProducts(availableProducts);
      
      console.log('Available products:', availableProducts);
      
      // If no products available after initialization, show error
      if (availableProducts.length === 0 && initialized) {
        setError('Subscription plans not currently available. This may be due to network issues or App Store configuration.');
      }
    } catch (err) {
      console.error('Error updating products list:', err);
    }
  };

  const finishPurchase = async (product) => {
    try {
      console.log('Finishing purchase:', product);
      
      // CRITICAL: Always finish the purchase first to avoid billing issues
      await product.finish();
      
      // Then verify with your backend
      const verificationResult = await verifyReceipt(product);
      
      if (verificationResult.valid) {
        console.log('Purchase verified successfully');
        onPaymentSuccess();
        onClose();
      } else {
        const errorMsg = verificationResult.error || 'Purchase verification failed';
        console.error('Purchase verification failed:', verificationResult);
        setError(errorMsg);
        // IMPORTANT: Even if verification fails, the purchase was finished so user won't be charged again
      }
    } catch (err) {
      console.error('Purchase completion error:', err);
      setError('Failed to complete purchase. Please contact support.');
    } finally {
      setPurchaseInProgress(false);
      setLoading(false);
    }
  };

  const verifyReceipt = async (product) => {
    try {
      const userToken = localStorage.getItem("auth_token");
      if (!userToken) {
        throw new Error('User not authenticated');
      }

      const BASE_URL = "https://kithia.com/website_b5d91c8e/api";

      // Get receipt data
      let receiptData;
      if (product.transaction?.appStoreReceipt) {
        receiptData = product.transaction.appStoreReceipt;
      } else if (product.transaction?.receipt) {
        receiptData = product.transaction.receipt;
      } else {
        // Fallback: try to get latest receipt
        receiptData = await InAppPurchase.getReceipt();
      }

      if (!receiptData) {
        throw new Error('No receipt data found');
      }

      const response = await fetch(`${BASE_URL}/subscription/verify-apple`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          receipt_data: receiptData,
          product_id: product.id,
          platform: 'ios'
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
      }

      return await response.json();
    } catch (err) {
      console.error('Receipt verification error:', err);
      return { 
        valid: false, 
        error: err.message || 'Verification service unavailable' 
      };
    }
  };

  const handlePlanChange = (plan) => setSelectedPlan(plan);

  const handleSubscribe = async () => {
    if (!InAppPurchase) {
      setError('In-app purchases not available on this device');
      return;
    }

    if (!initialized) {
      setError('Payment system still initializing. Please wait...');
      return;
    }

    if (products.length === 0) {
      setError('No subscription plans available. Please try again later.');
      return;
    }

    setLoading(true);
    setError(null);
    setPurchaseInProgress(true);

    try {
      const productId = selectedPlan === 'monthly' ? PRODUCT_IDS.monthly : PRODUCT_IDS.yearly;
      const product = InAppPurchase.get(productId);

      if (!product) {
        throw new Error('Subscription plan not available. Please try again later.');
      }

      if (!product.canPurchase) {
        throw new Error('This subscription is not available for purchase.');
      }

      console.log('Initiating purchase for:', productId);
      
      // Initiate purchase
      await InAppPurchase.order(productId);
      // The purchase flow continues through the event handlers

    } catch (err) {
      console.error('Purchase initiation error:', err);
      setError(err.message || 'Failed to start purchase. Please try again.');
      setPurchaseInProgress(false);
      setLoading(false);
    }
  };

  const getProductPrice = (productId) => {
    const product = products.find(p => p.id === productId);
    if (product && product.price) {
      return product.price;
    }
    return FALLBACK_PRICES[productId.includes('monthly') ? 'monthly' : 'yearly'];
  };

  const getProductTitle = (productId) => {
    const product = products.find(p => p.id === productId);
    if (product && product.title) {
      // Clean up the title (remove app name if present)
      return product.title.replace(/ - Sara Stories$/, '');
    }
    return FALLBACK_TITLES[productId.includes('monthly') ? 'monthly' : 'yearly'];
  };

  const getButtonText = () => {
    if (loading && !purchaseInProgress) return "Initializing...";
    if (purchaseInProgress) return "Processing...";
    if (products.length === 0) return "Loading plans...";
    return "Subscribe Now";
  };

  const isButtonDisabled = () => {
    return loading || purchaseInProgress || !initialized || products.length === 0;
  };

  // Reset state when modal closes
  useEffect(() => {
    if (!show) {
      setError(null);
      setLoading(false);
      setPurchaseInProgress(false);
    }
  }, [show]);

  return (
    <>
      <Modal
        show={show}
        onHide={onClose}
        fullscreen={true}
        dialogClassName="bg-transparent border-0"
        backdropClassName="custom-backdrop"
        centered
      >
        <Modal.Header closeButton className="border-0">
          <Modal.Title className="text-white w-100 text-center">
            Subscribe to Sara Stories
          </Modal.Title>
        </Modal.Header>
        
        <Modal.Body className="d-flex flex-column justify-content-between align-items-center text-white">
            <ul className="list-unstyled text-center mb-5 benefits-list">
              <li><BsMoonStarsFill className="benefits-icon"/> Peaceful and restful sleep for your child</li>
              <li><BsMoonStarsFill className="benefits-icon"/> More than 3000 illustrations</li>
              <li><BsMoonStarsFill className="benefits-icon"/> Cancel anytime</li>
              <li><BsMoonStarsFill className="benefits-icon"/> Secure payment via Apple</li>
            </ul>

            <div style={{ height: "24px" }}></div>

            <Row className="w-100 justify-content-center">
              <Col md={6}>
                <h5 className="mb-3 text-white text-center">Select Plan</h5>
                
                <div
                  className={`plan-option mb-3 p-3 rounded d-flex align-items-center ${
                    selectedPlan === "monthly" ? "selected" : ""
                  }`}
                  onClick={() => handlePlanChange("monthly")}
                  style={{ cursor: "pointer" }}
                >
                  <Form.Check
                    type="radio"
                    id="monthly"
                    name="plan"
                    checked={selectedPlan === "monthly"}
                    onChange={() => handlePlanChange("monthly")}
                    className="me-3 custom-radio"
                  />
                  <div className="d-flex flex-column flex-grow-1">
                    <span className="text-white fw-bold">
                      {getProductTitle(PRODUCT_IDS.monthly)}
                    </span>
                    <small className="text-white-50">
                      {getProductPrice(PRODUCT_IDS.monthly)}
                    </small>
                  </div>
                </div>

                <div
                  className={`plan-option mb-3 p-3 rounded d-flex align-items-center ${
                    selectedPlan === "yearly" ? "selected" : ""
                  }`}
                  onClick={() => handlePlanChange("yearly")}
                  style={{ cursor: "pointer" }}
                >
                  <Form.Check
                    type="radio"
                    id="yearly"
                    name="plan"
                    checked={selectedPlan === "yearly"}
                    onChange={() => handlePlanChange("yearly")}
                    className="me-3 custom-radio"
                  />
                  <div className="d-flex flex-column flex-grow-1">
                    <span className="text-white fw-bold">
                      {getProductTitle(PRODUCT_IDS.yearly)}
                    </span>
                    <small className="text-white-50">
                      {getProductPrice(PRODUCT_IDS.yearly)}
                    </small>
                  </div>
                </div>

                <div className="mt-4 p-3 rounded text-center" style={{background: 'rgba(255,255,255,0.1)'}}>
                  <small className="text-white-50">
                    Payment processed securely through Apple. Subscriptions auto-renew until canceled in Settings.
                  </small>
                </div>
              </Col>
            </Row>

            {error && (
              <Alert variant="danger" className="mt-3 w-100 text-center">
                {error}
                <div className="mt-2">
                  <Button 
                    variant="outline-info" 
                    size="sm" 
                    onClick={debugEnvironment}
                  >
                    Debug Info
                  </Button>
                </div>
              </Alert>
            )}

          <div className="w-100 text-center">
            <Button
              variant="warning"
              className="mt-4 w-75 fw-bold py-2"
              onClick={handleSubscribe}
              disabled={isButtonDisabled()}
              size="lg"
            >
              {loading || purchaseInProgress ? (
                <Spinner animation="border" size="sm" className="me-2" />
              ) : null}
              {getButtonText()}
            </Button>

            <div className="mt-4">
              <a
                href="#"
                className="text-decoration-underline text-warning"
                onClick={handlePrivacyPolicyClick}
              >
                Privacy Policy
              </a>
            </div>
            
            <div className="mt-2 text-center">
              <small className="text-white-50">
                Manage subscriptions in Settings
              </small>
            </div>
          </div>
        </Modal.Body>
      </Modal>

      {/* Parental Gate Modal */}
      <ParentalGateModal
        show={showParentalGate}
        onClose={handleParentalGateClose}
        onSuccess={handleParentalGateSuccess}
        title="For Mom and Dad"
        instruction="Please answer this question to view our Privacy Policy:"
      />
    </>
  );
};

export default SubscriptionModal;