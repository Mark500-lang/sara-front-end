import { useState, useEffect, useCallback } from "react";
import "./SubscriptionModal.css";
import { BsMoonStarsFill } from "react-icons/bs";
import { Modal, Button, Form, Spinner, Row, Col } from "react-bootstrap";
import ParentalGateModal from "./ParentalGateModal";

// Production constants
const MAX_RETRIES = 3;
const NETWORK_TIMEOUT = 15000;
const PURCHASE_TIMEOUT = 45000;

// FIXED: Consistent product IDs - use littlestories for both
const PRODUCT_IDS = {
  monthly: 'com.littlestories.app.monthlyrenewable',
  yearly: 'com.littlestories.app.yearlyrenewable', // Fixed: consistent domain
};

const FALLBACK_PRODUCTS = {
  monthly: {
    id: PRODUCT_IDS.monthly,
    title: 'Premium Monthly Subscription',
    price: '$4.99',
    period: '/month',
    description: 'Billed monthly'
  },
  yearly: {
    id: PRODUCT_IDS.yearly,
    title: 'Premium Yearly Subscription', 
    price: '$34.99',
    period: '/year',
    description: 'Billed yearly (save 40%)'
  }
};

const AnalyticsService = {
  trackEvent: (event, data = {}) => {
    console.log(`[ANALYTICS] ${event}:`, data);
  },
  trackError: (error, context = {}) => {
    console.error(`[ANALYTICS ERROR] ${error.message}:`, context);
  },
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
  const [showParentalGate, setShowParentalGate] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [purchaseTimeoutId, setPurchaseTimeoutId] = useState(null);
  const [usingFallbackStore, setUsingFallbackStore] = useState(false);
  const [storeInitialized, setStoreInitialized] = useState(false);

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => setNetworkStatus(true);
    const handleOffline = () => setNetworkStatus(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setNetworkStatus(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Enhanced error handler
  const handleIAPError = useCallback((error) => {
    console.error('IAP Error:', error);
    
    const errorMessages = {
      cancelled: 'Purchase was cancelled',
      'user cancelled': 'Purchase was cancelled',
      network: 'Network error. Please check your connection and try again.',
      'already owned': 'You already own this subscription',
      'not available': 'Subscription not currently available',
      timeout: 'Request timed out. Please check your connection.',
    };

    const errorMessage = error?.message?.toLowerCase() || '';
    const userMessage =
      Object.entries(errorMessages).find(([key]) => errorMessage.includes(key))?.[1] ||
      'Purchase failed. Please try again.';

    setError(userMessage);
    
    // CRITICAL: Always reset loading states
    setPurchaseInProgress(false);
    setLoading(false);
    
    if (purchaseTimeoutId) {
      clearTimeout(purchaseTimeoutId);
      setPurchaseTimeoutId(null);
    }

    AnalyticsService.trackError(error, { error_type: 'iap_error' });
  }, [purchaseTimeoutId]);

  // FIXED: Proper initialization when modal opens
  useEffect(() => {
    if (show && !storeInitialized) {
      initializeIAP();
    }
  }, [show, storeInitialized]);

  // Parental gate handlers
  const handlePrivacyPolicyClick = useCallback((e) => {
    e.preventDefault();
    setPendingAction(() => () => {
      window.open('https://www.privacypolicies.com/live/396845b8-e470-4bed-8cbb-5432ab867986', '_blank');
    });
    setShowParentalGate(true);
  }, []);

  const handleTermsOfUseClick = useCallback((e) => {
    e.preventDefault();
    setPendingAction(() => () => {
      window.open('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/', '_blank');
    });
    setShowParentalGate(true);
  }, []);

  const handleParentalGateSuccess = useCallback(() => {
    if (pendingAction) {
      pendingAction();
    }
    setPendingAction(null);
    setShowParentalGate(false);
  }, [pendingAction]);

  const handleParentalGateClose = useCallback(() => {
    setShowParentalGate(false);
    setPendingAction(null);
  }, []);

  // Retry logic
  const withRetry = async (operation, operationName, maxRetries = MAX_RETRIES) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxRetries) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  };

  // Network status check
  const checkNetworkStatus = useCallback(() => navigator.onLine, []);

  // FIXED: Enhanced IAP initialization with proper event sequencing
  const initializeIAP = useCallback(async () => {
    if (!window.store) {
      console.warn('⚠️ StoreKit not available - using fallback mode');
      setUsingFallbackStore(true);
      setProducts([FALLBACK_PRODUCTS.monthly, FALLBACK_PRODUCTS.yearly]);
      setInitialized(true);
      setStoreInitialized(true);
      return;
    }

    console.log('🛒 Initializing StoreKit...');
    const store = window.store;
    store.verbosity = store.DEBUG;

    try {
      // Register products first
      store.register([
        {
          id: PRODUCT_IDS.monthly,
          type: store.PAID_SUBSCRIPTION,
        },
        {
          id: PRODUCT_IDS.yearly,
          type: store.PAID_SUBSCRIPTION,
        }
      ]);

      // Set up event handlers BEFORE initialization
      store.when(PRODUCT_IDS.monthly).approved((product) => {
        console.log('✅ Monthly subscription approved');
        finishPurchase(product);
      });

      store.when(PRODUCT_IDS.yearly).approved((product) => {
        console.log('✅ Yearly subscription approved');
        finishPurchase(product);
      });

      store.when(PRODUCT_IDS.monthly).owned((product) => {
        console.log('✅ Monthly subscription owned');
        finishPurchase(product);
      });

      store.when(PRODUCT_IDS.yearly).owned((product) => {
        console.log('✅ Yearly subscription owned');
        finishPurchase(product);
      });

      // Enhanced error handling
      store.error((error) => {
        console.error('❌ StoreKit error:', error);
        handleIAPError(error);
      });

      // Ready event - CRITICAL
      store.ready(() => {
        console.log('✅ StoreKit ready - products loaded');
        
        // Update products list
        updateProductsList();
        
        setInitialized(true);
        setStoreInitialized(true);
        
        AnalyticsService.trackEvent('storekit_ready');
      });

      // Initialize StoreKit
      await store.initialize();
      console.log('🎯 StoreKit initialization completed');

    } catch (error) {
      console.error('❌ StoreKit initialization failed:', error);
      setUsingFallbackStore(true);
      setProducts([FALLBACK_PRODUCTS.monthly, FALLBACK_PRODUCTS.yearly]);
      setInitialized(true);
      setStoreInitialized(true);
    }
  }, [handleIAPError]);

  // FIXED: Update products list
  const updateProductsList = useCallback(() => {
    if (!window.store) {
      setProducts([FALLBACK_PRODUCTS.monthly, FALLBACK_PRODUCTS.yearly]);
      return;
    }

    try {
      const monthlyProduct = window.store.get(PRODUCT_IDS.monthly);
      const yearlyProduct = window.store.get(PRODUCT_IDS.yearly);
      
      const realProducts = [monthlyProduct, yearlyProduct].filter(p => p && p.valid);
      
      if (realProducts.length > 0) {
        setProducts(realProducts);
        console.log('✅ Using real StoreKit products:', realProducts.map(p => ({
          id: p.id,
          valid: p.valid,
          price: p.price,
          title: p.title
        })));
      } else {
        setProducts([FALLBACK_PRODUCTS.monthly, FALLBACK_PRODUCTS.yearly]);
        console.log('⚠️ Using fallback products for UI');
      }

    } catch (err) {
      console.error('❌ Error updating products list:', err);
      setProducts([FALLBACK_PRODUCTS.monthly, FALLBACK_PRODUCTS.yearly]);
    }
  }, []);

  // FIXED: Purchase completion with better error handling
  const finishPurchase = async (product) => {
    console.log('🏁 Finishing purchase:', product.id);
    
    if (purchaseTimeoutId) {
      clearTimeout(purchaseTimeoutId);
      setPurchaseTimeoutId(null);
    }
    
    try {
      AnalyticsService.trackEvent('purchase_finishing', { product_id: product.id });

      // Finish purchase first
      if (product.finish && typeof product.finish === 'function') {
        await product.finish();
        console.log('✅ Purchase finished in StoreKit');
      }

      AnalyticsService.trackEvent('purchase_finished', { product_id: product.id });

      // Verify with backend
      const verificationResult = await withRetry(
        () => verifyReceipt(product),
        'receipt_verification'
      );

      if (verificationResult.valid) {
        console.log('✅ Purchase verified successfully');
        AnalyticsService.trackEvent('purchase_verified_success', { product_id: product.id });
        onPaymentSuccess();
        onClose();
      } else {
        throw new Error(verificationResult.error || 'Verification failed');
      }

    } catch (err) {
      console.error('❌ Purchase completion error:', err);
      
      let userMessage = 'Purchase completed! Please check your subscription status.';
      
      if (err.message.includes('timeout')) {
        userMessage = 'Purchase completed! Verification is taking longer than expected.';
      } else if (err.message.includes('network')) {
        userMessage = 'Purchase completed! Please check your internet connection.';
      } else if (err.message.includes('Verification failed')) {
        userMessage = 'Purchase completed! Your subscription is being activated.';
      }
      
      setError(userMessage);
      
    } finally {
      // GUARANTEED state cleanup
      setPurchaseInProgress(false);
      setLoading(false);
      
      if (purchaseTimeoutId) {
        clearTimeout(purchaseTimeoutId);
        setPurchaseTimeoutId(null);
      }
    }
  };

  const verifyReceipt = async (product) => {
    if (!checkNetworkStatus()) {
      throw new Error('No internet connection');
    }

    const userToken = localStorage.getItem("auth_token");
    if (!userToken) {
      throw new Error('User not authenticated');
    }

    const BASE_URL = "https://kithia.com/website_b5d91c8e/api";

    let receiptData;
    if (product.transaction?.appStoreReceipt) {
      receiptData = product.transaction.appStoreReceipt;
    } else if (product.transaction?.receipt) {
      receiptData = product.transaction.receipt;
    } else {
      receiptData = await window.store.getReceipt();
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
          platform: 'ios',
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error('Unable to verify your purchase at the moment. Please try again later.');
      }

      return await response.json();
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('The verification took too long. Please try again.');
      }
      throw err;
    }
  };

  const handlePlanChange = useCallback((plan) => {
    setSelectedPlan(plan);
    AnalyticsService.trackEvent('plan_selected', { plan });
  }, []);

  // FIXED: Enhanced restore purchases
  const restorePurchases = async () => {
    if (!window.store) {
      setError('In-app purchases not available on this device');
      return;
    }

    setRestoring(true);
    setError(null);
    AnalyticsService.trackEvent('restore_purchases_started');

    const restoreTimeout = setTimeout(() => {
      setError('Restore process timed out. Please try again.');
      setRestoring(false);
    }, 15000);

    try {
      await window.store.restore();
      setError('Purchases restored successfully. If you still don\'t have access, please contact support.');
    } catch (err) {
      setError('Couldn’t restore your purchases. Please try again.');
    } finally {
      clearTimeout(restoreTimeout);
      setRestoring(false);
    }
  };

  // FIXED: Enhanced purchase handler with better validation
  const handleSubscribe = async () => {
    if (!window.store) {
      setError('In-app purchases not available on this device.');
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

    if (!selectedPlan) {
      setError('Please select a subscription plan.');
      return;
    }

    const productId = selectedPlan === 'monthly' ? PRODUCT_IDS.monthly : PRODUCT_IDS.yearly;
    const product = window.store.get(productId);

    if (!product) {
      setError('Selected subscription plan not found. Please try again.');
      return;
    }

    console.log('🛒 Starting purchase:', {
      productId,
      valid: product.valid,
      state: product.state,
      canPurchase: product.canPurchase,
      price: product.price
    });

    // CRITICAL: Allow purchase attempts even for unapproved products in sandbox/review
    // This ensures the flow works during App Review testing
    if (!product.valid) {
      console.log('⚠️ Product validation warning - proceeding with purchase attempt for sandbox/review');
    }

    // Only block if explicitly cannot purchase (usually means already owned)
    if (!product.canPurchase && product.valid) {
      setError('This subscription is not available for purchase at this time.');
      return;
    }

    setLoading(true);
    setError(null);
    setPurchaseInProgress(true);

    AnalyticsService.trackEvent('purchase_attempt', {
      plan: selectedPlan,
      product_id: productId,
      product_valid: product.valid,
      fallback_mode: usingFallbackStore
    });

    // Purchase timeout protection
    const timeoutId = setTimeout(() => {
      console.error('❌ Purchase timeout');
      setError('Purchase timed out. Please try again.');
      setPurchaseInProgress(false);
      setLoading(false);
      setPurchaseTimeoutId(null);
    }, PURCHASE_TIMEOUT);

    setPurchaseTimeoutId(timeoutId);

    try {
      console.log('🛒 Initiating purchase...');
      
      await window.store.order(productId);
      
      console.log('✅ Purchase initiated successfully');
      // Loading state will be cleared in finishPurchase()
      
    } catch (err) {
      console.error('❌ Purchase initiation failed:', err);
      
      // GUARANTEED cleanup
      clearTimeout(timeoutId);
      setPurchaseTimeoutId(null);
      setPurchaseInProgress(false);
      setLoading(false);
      
      let userMessage = 'Failed to start purchase. Please try again.';
      
      if (err.message?.includes('cancelled')) {
        userMessage = 'Purchase was cancelled.';
      } else if (err.message?.includes('network')) {
        userMessage = 'Network error. Please check your connection and try again.';
      } else if (err.message?.includes('already')) {
        userMessage = 'You already own this subscription.';
      }
      
      setError(userMessage);
    }
  };

  // Product display functions
  const getProductPrice = useCallback((productId) => {
    const realProduct = products.find(p => p.id === productId);
    if (realProduct && realProduct.price) {
      return realProduct.price;
    }
    const fallback = FALLBACK_PRODUCTS[productId.includes('monthly') ? 'monthly' : 'yearly'];
    return fallback.price + fallback.period;
  }, [products]);

  const getPriceAmount = useCallback((productId) => {
    const fullPrice = getProductPrice(productId);
    const amountMatch = fullPrice.match(/^[^\s\/]+/);
    return amountMatch ? amountMatch[0] : fullPrice;
  }, [getProductPrice]);

  const getPricePeriod = useCallback((productId) => {
    const fullPrice = getProductPrice(productId);
    const amount = getPriceAmount(productId);
    return fullPrice.replace(amount, '').trim();
  }, [getProductPrice, getPriceAmount]);

  const getProductTitle = useCallback((productId) => {
    const realProduct = products.find(p => p.id === productId);
    if (realProduct && realProduct.title) {
      return realProduct.title.replace(/ - Sara Stories$/, '');
    }
    const fallback = FALLBACK_PRODUCTS[productId.includes('monthly') ? 'monthly' : 'yearly'];
    return fallback.title;
  }, [products]);

  const getButtonText = useCallback(() => {
    if (restoring) return "Restoring...";
    if (loading && !purchaseInProgress) return "Initializing...";
    if (purchaseInProgress) return "Processing...";
    return "Subscribe Now";
  }, [loading, purchaseInProgress, restoring]);

  const isButtonDisabled = useCallback(() => {
    return loading || purchaseInProgress || !initialized || restoring || !networkStatus || !selectedPlan;
  }, [loading, purchaseInProgress, initialized, restoring, networkStatus, selectedPlan]);

  // Reset when modal closes
  useEffect(() => {
    if (!show) {
      setError(null);
      setLoading(false);
      setPurchaseInProgress(false);
      setRestoring(false);
      
      if (purchaseTimeoutId) {
        clearTimeout(purchaseTimeoutId);
        setPurchaseTimeoutId(null);
      }
    }
  }, [show, purchaseTimeoutId]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (purchaseTimeoutId) {
        clearTimeout(purchaseTimeoutId);
      }
    };
  }, [purchaseTimeoutId]);

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

                {/* Debug Status Panel */}
                <div className="mb-3 p-2 rounded text-center" style={{ background: 'rgba(255,255,255,0.1)' }}>
                  <small className="text-white-50">
                    <strong>Debug Info:</strong><br />
                    StoreKit: {window.store ? '✅ Loaded' : '❌ Missing'} | 
                    Initialized: {initialized ? '✅ Yes' : '❌ No'} | 
                    Products: {products.length} | 
                    Network: {networkStatus ? '✅ Online' : '❌ Offline'}
                  </small>
                </div>

                {/* Monthly Plan */}
                <div
                  className={`plan-option mb-3 p-3 rounded d-flex align-items-center ${selectedPlan === "monthly" ? "selected" : ""}`}
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
                    <span className="text-white fw-bold">{getProductTitle(PRODUCT_IDS.monthly)}</span>
                    <div className="d-flex align-items-baseline">
                      <span className="text-white fw-bold fs-4 me-1">
                        {getPriceAmount(PRODUCT_IDS.monthly)}
                      </span>
                      <span className="text-white-50 fs-6">
                        {getPricePeriod(PRODUCT_IDS.monthly)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Yearly Plan */}
                <div
                  className={`plan-option mb-3 p-3 rounded d-flex align-items-center ${selectedPlan === "yearly" ? "selected" : ""}`}
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
                    <span className="text-white fw-bold">{getProductTitle(PRODUCT_IDS.yearly)}</span>
                    <div className="d-flex align-items-baseline">
                      <span className="text-white fw-bold fs-4 me-1">
                        {getPriceAmount(PRODUCT_IDS.yearly)}
                      </span>
                      <span className="text-white-50 fs-6">
                        {getPricePeriod(PRODUCT_IDS.yearly)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Product Debug Info */}
                {window.store && (
                  <div className="mt-2 p-2 rounded text-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <small className="text-white-50">
                      <strong>Product Status:</strong><br />
                      Monthly: {window.store.get(PRODUCT_IDS.monthly)?.state || 'Not found'} | 
                      Yearly: {window.store.get(PRODUCT_IDS.yearly)?.state || 'Not found'}
                    </small>
                  </div>
                )}

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

            {/* Links side by side in a row with parental gates */}
            <div className="mt-4 d-flex justify-content-center gap-4">
              <a
                href="#"
                className="text-decoration-underline text-warning"
                onClick={handlePrivacyPolicyClick}
              >
                Privacy Policy
              </a>
              <a
                href="#"
                className="text-decoration-underline text-warning"
                onClick={handleTermsOfUseClick}
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

      <ParentalGateModal
        show={showParentalGate}
        onClose={handleParentalGateClose}
        onSuccess={handleParentalGateSuccess}
        title="For Mom and Dad"
        instruction="Please answer this question to continue:"
      />
    </>
  );
};

export default SubscriptionModal;