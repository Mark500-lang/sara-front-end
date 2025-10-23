import { useState, useEffect, useCallback } from "react";
import "./SubscriptionModal.css";
import { BsMoonStarsFill } from "react-icons/bs";
import { Modal, Button, Form, Spinner, Alert, Row, Col } from "react-bootstrap";
import ParentalGateModal from "./ParentalGateModal";

// Initialize the purchase plugin
let InAppPurchase = null;

// Production constants
const MAX_RETRIES = 3;
const INIT_TIMEOUT = 10000; // 10 seconds
const NETWORK_TIMEOUT = 15000; // 15 seconds

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

// Analytics service (replace with your actual analytics in production)
const AnalyticsService = {
  trackEvent: (event, data = {}) => {
    // Production: Replace with your analytics service (Firebase, Mixpanel, etc.)
    console.log(`[ANALYTICS] ${event}:`, { 
      timestamp: new Date().toISOString(),
      ...data 
    });
    
    // Example integration with actual services:
    /*
    if (window.gtag) {
      window.gtag('event', event, data);
    }
    if (window.fbq) {
      window.fbq('track', event, data);
    }
    */
  },
  
  trackError: (error, context = {}) => {
    console.error(`[ANALYTICS ERROR] ${error.message}:`, {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack,
      ...context
    });
  }
};

const SubscriptionModal = ({ show, onClose, onPaymentSuccess }) => {
  const [selectedPlan, setSelectedPlan] = useState("yearly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [products, setProducts] = useState([]);
  const [purchaseInProgress, setPurchaseInProgress] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [networkStatus, setNetworkStatus] = useState(true);
  
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

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => {
      setNetworkStatus(true);
      AnalyticsService.trackEvent('network_online');
    };
    
    const handleOffline = () => {
      setNetworkStatus(false);
      AnalyticsService.trackEvent('network_offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Set initial network status
    setNetworkStatus(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Enhanced error handler with production error mapping
  const handleIAPError = useCallback((error) => {
    console.error('IAP Error:', error);
    
    // Production error mapping
    const errorMessages = {
      'cancelled': 'Purchase was cancelled',
      'user cancelled': 'Purchase was cancelled',
      'network': 'Network error. Please check your connection and try again.',
      'already owned': 'You already own this subscription',
      'not available': 'Subscription not currently available in your region',
      'parental controls': 'Purchases are disabled by parental controls',
      'not allowed': 'Purchases are not allowed on this device',
      'invalid product': 'Subscription plan not available',
      'configuration': 'Store configuration error. Please try again later.',
      'timeout': 'Request timed out. Please check your connection.',
      'receipt': 'Purchase verification failed. Please contact support.',
      'unauthorized': 'Authentication required. Please sign in and try again.'
    };

    const errorMessage = error?.message?.toLowerCase() || '';
    const userMessage = Object.entries(errorMessages).find(([key]) => 
      errorMessage.includes(key)
    )?.[1] || 'Purchase failed. Please try again.';

    setError(userMessage);
    setPurchaseInProgress(false);
    setLoading(false);

    // Track error analytics
    AnalyticsService.trackError(error, {
      error_type: 'iap_error',
      error_message: errorMessage,
      user_message: userMessage,
      component: 'SubscriptionModal'
    });
  }, []);

  // Debug function to check environment
  const debugEnvironment = useCallback(() => {
    const debugInfo = {
      'window.store': window.store,
      'window.cordova': window.cordova,
      'window.Capacitor': window.Capacitor,
      'document.readyState': document.readyState,
      'User Agent': navigator.userAgent,
      'Platform': navigator.platform,
      'Network Status': navigator.onLine,
      'Products Loaded': products.length,
      'Initialized': initialized
    };
    
    console.log('=== IAP ENVIRONMENT DEBUG ===', debugInfo);
    AnalyticsService.trackEvent('debug_info', debugInfo);
  }, [products.length, initialized]);

  useEffect(() => {
    if (show && !initialized) {
      debugEnvironment();
      initializeIAP();
    }
  }, [show, initialized, debugEnvironment]);

  // Parental Gate Handlers
  const handlePrivacyPolicyClick = useCallback((e) => {
    e.preventDefault();
    AnalyticsService.trackEvent('privacy_policy_clicked');
    setPendingAction(() => () => {
      window.open('https://www.privacypolicies.com/live/396845b8-e470-4bed-8cbb-5432ab867986', '_blank');
      AnalyticsService.trackEvent('privacy_policy_opened');
    });
    setShowParentalGate(true);
  }, []);

  const handleParentalGateSuccess = useCallback(() => {
    if (pendingAction) {
      pendingAction();
    }
    setPendingAction(null);
    AnalyticsService.trackEvent('parental_gate_passed');
  }, [pendingAction]);

  const handleParentalGateClose = useCallback(() => {
    setShowParentalGate(false);
    setPendingAction(null);
    AnalyticsService.trackEvent('parental_gate_cancelled');
  }, []);

  // Network resilience with retry logic
  const withRetry = async (operation, operationName, maxRetries = MAX_RETRIES) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        AnalyticsService.trackEvent(`operation_attempt`, {
          operation: operationName,
          attempt,
          max_retries: maxRetries
        });
        
        const result = await operation();
        AnalyticsService.trackEvent(`operation_success`, {
          operation: operationName,
          attempt
        });
        return result;
      } catch (error) {
        AnalyticsService.trackError(error, {
          operation: operationName,
          attempt,
          max_retries: maxRetries
        });
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Exponential backoff
        const backoffTime = 1000 * Math.pow(2, attempt - 1);
        console.log(`Retrying ${operationName} in ${backoffTime}ms (attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }
    }
  };

  // Network status check
  const checkNetworkStatus = useCallback(() => {
    const isOnline = navigator.onLine;
    if (!isOnline) {
      AnalyticsService.trackEvent('network_check_failed');
    }
    return isOnline;
  }, []);

  const initializeIAP = async () => {
    AnalyticsService.trackEvent('iap_initialization_started');
    
    if (!checkNetworkStatus()) {
      const error = new Error('No internet connection');
      setError('No internet connection. Please check your network and try again.');
      AnalyticsService.trackError(error, { stage: 'network_check' });
      setInitialized(true);
      return;
    }

    setLoading(true);

    try {
      const initializationPromise = (async () => {
        console.log('Initializing In-App Purchase...');
        
        // Wait for Cordova to be ready
        InAppPurchase = await waitForCordova();
        
        if (!InAppPurchase) {
          throw new Error('Cordova Purchase plugin not available after waiting');
        }

        console.log('Cordova Purchase plugin found:', InAppPurchase);

        // Configure the plugin
        InAppPurchase.verbosity = InAppPurchase.WARNING; // Use WARNING for production
        
        // Register products with retry
        await withRetry(async () => {
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
        }, 'product_registration');

        console.log('Products registered successfully');

        // Set up event handlers
        InAppPurchase.when("product")
          .updated((product) => {
            console.log('Product updated:', product.id, product.valid ? 'VALID' : 'INVALID');
            updateProductsList();
          });

        InAppPurchase.when(PRODUCT_IDS.monthly)
          .approved((product) => {
            console.log('Monthly subscription approved:', product);
            AnalyticsService.trackEvent('purchase_approved', { product_id: PRODUCT_IDS.monthly });
            finishPurchase(product);
          });
          
        InAppPurchase.when(PRODUCT_IDS.yearly)
          .approved((product) => {
            console.log('Yearly subscription approved:', product);
            AnalyticsService.trackEvent('purchase_approved', { product_id: PRODUCT_IDS.yearly });
            finishPurchase(product);
          });

        InAppPurchase.when("error").then((error) => {
          console.error('IAP Error event:', error);
          AnalyticsService.trackEvent('purchase_error_event', { error: error.message });
          handleIAPError(error);
        });

        // Refresh to load product details with retry
        await withRetry(async () => {
          await InAppPurchase.refresh();
        }, 'product_refresh');

        console.log('IAP refresh completed');
      })();

      // Add timeout to initialization
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('IAP initialization timeout')), INIT_TIMEOUT)
      );

      await Promise.race([initializationPromise, timeoutPromise]);
      
      setInitialized(true);
      setLoading(false);
      AnalyticsService.trackEvent('iap_initialization_success');

    } catch (err) {
      console.error('IAP Initialization error:', err);
      const errorMessage = err.message.includes('timeout') 
        ? 'Store initialization timed out. Please check your connection and try again.'
        : `Failed to initialize in-app purchases: ${err.message}`;
      
      setError(errorMessage);
      setInitialized(true);
      setLoading(false);
      AnalyticsService.trackError(err, { stage: 'initialization' });
    }
  };

  const updateProductsList = useCallback(() => {
    try {
      const monthlyProduct = InAppPurchase.get(PRODUCT_IDS.monthly);
      const yearlyProduct = InAppPurchase.get(PRODUCT_IDS.yearly);
      
      const availableProducts = [monthlyProduct, yearlyProduct].filter(p => p && p.valid);
      setProducts(availableProducts);
      
      console.log('Available products:', availableProducts);
      
      // Track product availability
      AnalyticsService.trackEvent('products_updated', {
        available_count: availableProducts.length,
        monthly_available: !!monthlyProduct?.valid,
        yearly_available: !!yearlyProduct?.valid
      });
      
      // If no products available after initialization, show error
      if (availableProducts.length === 0 && initialized) {
        setError('Subscription plans not currently available. This may be due to network issues or App Store configuration.');
        AnalyticsService.trackEvent('no_products_available');
      }
    } catch (err) {
      console.error('Error updating products list:', err);
      AnalyticsService.trackError(err, { stage: 'update_products_list' });
    }
  }, [initialized]);

  const finishPurchase = async (product) => {
    try {
      console.log('Finishing purchase:', product);
      AnalyticsService.trackEvent('purchase_finishing', { product_id: product.id });
      
      // CRITICAL: Always finish the purchase first to avoid billing issues
      await product.finish();
      AnalyticsService.trackEvent('purchase_finished', { product_id: product.id });
      
      // Then verify with your backend with retry logic
      const verificationResult = await withRetry(
        () => verifyReceipt(product),
        'receipt_verification'
      );
      
      if (verificationResult.valid) {
        console.log('Purchase verified successfully');
        AnalyticsService.trackEvent('purchase_verified_success', { product_id: product.id });
        onPaymentSuccess();
        onClose();
      } else {
        const errorMsg = verificationResult.error || 'Purchase verification failed';
        console.error('Purchase verification failed:', verificationResult);
        AnalyticsService.trackEvent('purchase_verification_failed', { 
          product_id: product.id,
          error: errorMsg 
        });
        setError(errorMsg);
        // IMPORTANT: Even if verification fails, the purchase was finished so user won't be charged again
      }
    } catch (err) {
      console.error('Purchase completion error:', err);
      AnalyticsService.trackError(err, { stage: 'finish_purchase', product_id: product.id });
      setError('Failed to complete purchase. Please contact support.');
    } finally {
      setPurchaseInProgress(false);
      setLoading(false);
    }
  };

  const verifyReceipt = async (product) => {
    if (!checkNetworkStatus()) {
      throw new Error('No internet connection for receipt verification');
    }

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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), NETWORK_TIMEOUT);

    try {
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
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
      }

      return await response.json();
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Receipt verification timeout');
      }
      throw err;
    }
  };

  const handlePlanChange = useCallback((plan) => {
    setSelectedPlan(plan);
    AnalyticsService.trackEvent('plan_selected', { plan });
  }, []);

  // Purchase state recovery
  const restorePurchases = async () => {
    if (!InAppPurchase || !initialized) {
      setError('Please wait for store initialization to complete');
      return;
    }

    if (!checkNetworkStatus()) {
      setError('No internet connection. Please check your network to restore purchases.');
      return;
    }

    setRestoring(true);
    setError(null);
    AnalyticsService.trackEvent('restore_purchases_started');

    try {
      await withRetry(async () => {
        await InAppPurchase.restore();
      }, 'restore_purchases');

      AnalyticsService.trackEvent('restore_purchases_completed');
      setError('Purchases restored successfully. If you still don\'t have access, please contact support.');
    } catch (err) {
      console.error('Restore purchases error:', err);
      AnalyticsService.trackError(err, { stage: 'restore_purchases' });
      setError('Failed to restore purchases. Please try again or contact support.');
    } finally {
      setRestoring(false);
    }
  };

  const handleSubscribe = async () => {
    if (!InAppPurchase) {
      setError('In-app purchases not available on this device');
      return;
    }

    if (!initialized) {
      setError('Payment system still initializing. Please wait...');
      return;
    }

    if (!networkStatus) {
      setError('No internet connection. Please check your network and try again.');
      return;
    }

    if (products.length === 0) {
      setError('No subscription plans available. Please try again later.');
      return;
    }

    setLoading(true);
    setError(null);
    setPurchaseInProgress(true);

    AnalyticsService.trackEvent('purchase_initiated', { 
      plan: selectedPlan,
      product_id: selectedPlan === 'monthly' ? PRODUCT_IDS.monthly : PRODUCT_IDS.yearly
    });

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
      AnalyticsService.trackError(err, { stage: 'purchase_initiation', plan: selectedPlan });
      setError(err.message || 'Failed to start purchase. Please try again.');
      setPurchaseInProgress(false);
      setLoading(false);
    }
  };

  const getProductPrice = useCallback((productId) => {
    const product = products.find(p => p.id === productId);
    if (product && product.price) {
      return product.price;
    }
    return FALLBACK_PRICES[productId.includes('monthly') ? 'monthly' : 'yearly'];
  }, [products]);

  const getProductTitle = useCallback((productId) => {
    const product = products.find(p => p.id === productId);
    if (product && product.title) {
      // Clean up the title (remove app name if present)
      return product.title.replace(/ - Sara Stories$/, '');
    }
    return FALLBACK_TITLES[productId.includes('monthly') ? 'monthly' : 'yearly'];
  }, [products]);

  const getButtonText = useCallback(() => {
    if (restoring) return "Restoring...";
    if (loading && !purchaseInProgress) return "Initializing...";
    if (purchaseInProgress) return "Processing...";
    if (products.length === 0) return "Loading plans...";
    return "Subscribe Now";
  }, [loading, purchaseInProgress, products.length, restoring]);

  const isButtonDisabled = useCallback(() => {
    return loading || purchaseInProgress || !initialized || products.length === 0 || restoring || !networkStatus;
  }, [loading, purchaseInProgress, initialized, products.length, restoring, networkStatus]);

  // Reset state when modal closes
  useEffect(() => {
    if (!show) {
      setError(null);
      setLoading(false);
      setPurchaseInProgress(false);
      setRestoring(false);
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

                {!networkStatus && (
                  <Alert variant="warning" className="mt-3 text-center">
                    <small>No internet connection. Please check your network.</small>
                  </Alert>
                )}

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
                {/* <div className="mt-2">
                  <Button 
                    variant="outline-info" 
                    size="sm" 
                    onClick={debugEnvironment}
                    className="me-2"
                  >
                    Debug Info
                  </Button>
                  {error.includes('restore') && (
                    <Button 
                      variant="outline-warning" 
                      size="sm" 
                      onClick={restorePurchases}
                      disabled={restoring}
                    >
                      {restoring ? <Spinner animation="border" size="sm" /> : 'Restore Purchases'}
                    </Button>
                  )}
                </div> */}
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
              {loading || purchaseInProgress || restoring ? (
                <Spinner animation="border" size="sm" className="me-2" />
              ) : null}
              {getButtonText()}
            </Button>

            {/* <div className="mt-3">
              <Button
                variant="outline-light"
                size="sm"
                onClick={restorePurchases}
                disabled={restoring || !initialized || !networkStatus}
              >
                {restoring ? <Spinner animation="border" size="sm" className="me-2" /> : null}
                Restore Purchases
              </Button>
            </div> */}

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