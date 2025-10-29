import { useState, useEffect, useCallback } from "react";
import "./SubscriptionModal.css";
import { BsMoonStarsFill } from "react-icons/bs";
import { Modal, Button, Form, Spinner, Row, Col } from "react-bootstrap";
import ParentalGateModal from "./ParentalGateModal";

// Initialize the purchase plugin
let InAppPurchase = null;

// Production constants
const MAX_RETRIES = 3;
const INIT_TIMEOUT = 10000; // 10 seconds
const NETWORK_TIMEOUT = 15000; // 15 seconds

// FIXED: Enhanced Cordova purchase plugin initialization
const waitForCordova = () => {
  return new Promise((resolve, reject) => {
    console.log('🔄 Starting Cordova plugin initialization...');
    
    // Check if we're in a native environment
    const isNative = window.cordova || window.Capacitor?.isNativePlatform;
    if (!isNative) {
      reject(new Error('Not in native app environment'));
      return;
    }

    // If store is already available, use it immediately
    if (window.store && typeof window.store.register === 'function') {
      console.log('✅ Store plugin already available');
      resolve(window.store);
      return;
    }

    let initializationTimeout;
    let storeCheckInterval;
    let maxWaitTime = 10000; // 10 seconds max
    let startTime = Date.now();

    const cleanup = () => {
      document.removeEventListener('deviceready', onDeviceReady);
      document.removeEventListener('purchasesReady', onPurchasesReady);
      clearTimeout(initializationTimeout);
      clearInterval(storeCheckInterval);
    };

    const onDeviceReady = () => {
      console.log('📱 deviceready event received');
      startStoreCheck();
    };

    const onPurchasesReady = () => {
      console.log('🛒 purchasesReady event received');
      if (window.store && typeof window.store.register === 'function') {
        cleanup();
        console.log('✅ Store plugin initialized via purchasesReady event');
        resolve(window.store);
      }
    };

    const startStoreCheck = () => {
      console.log('🔍 Starting periodic store availability check...');
      
      storeCheckInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        
        if (window.store && typeof window.store.register === 'function') {
          cleanup();
          console.log(`✅ Store plugin available after ${elapsed}ms`);
          resolve(window.store);
          return;
        }

        // If we've waited too long, give up
        if (elapsed > maxWaitTime) {
          cleanup();
          console.error(`❌ Store plugin not available after ${maxWaitTime}ms`);
          reject(new Error(`Store initialization timed out after ${maxWaitTime}ms`));
          return;
        }

        console.log(`⏳ Waiting for store plugin... (${elapsed}ms elapsed)`);
      }, 500); // Check every 500ms
    };

    // Set overall timeout
    initializationTimeout = setTimeout(() => {
      cleanup();
      reject(new Error('Cordova plugin initialization timeout'));
    }, maxWaitTime + 2000); // Extra buffer

    // Listen for Cordova events
    document.addEventListener('deviceready', onDeviceReady, { once: true });
    document.addEventListener('purchasesReady', onPurchasesReady, { once: true });

    // If deviceready might have already fired, start checking immediately
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(() => {
        if (window.cordova && !window.store) {
          console.log('📱 Cordova available but store not ready, starting checks...');
          startStoreCheck();
        }
      }, 1000);
    }

    // Last resort: if we're in TestFlight and store exists, use it
    const isTestFlight = navigator.userAgent.includes('TestFlight');
    if (isTestFlight && window.store) {
      console.log('📱 TestFlight environment - using available store');
      cleanup();
      resolve(window.store);
    }
  });
};

// Analytics service
const AnalyticsService = {
  trackEvent: (event, data = {}) => {
    console.log(`[ANALYTICS] ${event}:`, {
      timestamp: new Date().toISOString(),
      ...data,
    });
    // Add production analytics (e.g., Firebase, Mixpanel) here
  },
  trackError: (error, context = {}) => {
    console.error(`[ANALYTICS ERROR] ${error.message}:`, {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack,
      ...context,
    });
    // Add production error tracking (e.g., Sentry) here
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

  const PRODUCT_IDS = {
    monthly: 'com.littlestories.app.premiummonthly',
    yearly: 'com.littlestories.app.premiumyearly',
  };

  const FALLBACK_PRICES = {
    monthly: '$4.99/month',
    yearly: '$34.99/year',
  };

  const FALLBACK_TITLES = {
    monthly: 'Monthly Subscription',
    yearly: 'Yearly Subscription',
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
    setNetworkStatus(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Enhanced error handler - REMOVED SERVER ERRORS FROM USER DISPLAY
  const handleIAPError = useCallback((error) => {
    console.error('IAP Error:', error);
    
    // User-friendly error messages only - no technical details
    const errorMessages = {
      cancelled: 'Purchase was cancelled',
      'user cancelled': 'Purchase was cancelled',
      network: 'Network error. Please check your connection and try again.',
      'already owned': 'You already own this subscription',
      'not available': 'Subscription not currently available',
      'parental controls': 'Purchases are disabled by parental controls',
      'not allowed': 'Purchases are not allowed on this device',
      'invalid product': 'Subscription plan not available',
      configuration: 'Store configuration error. Please try again later.',
      timeout: 'Request timed out. Please check your connection.',
      receipt: 'Unable to verify purchase. Please contact support.',
      unauthorized: 'Authentication required. Please sign in and try again.',
      'storekit initialization': 'Failed to initialize payment system. Please try again.',
    };

    const errorMessage = error?.message?.toLowerCase() || '';
    const userMessage =
      Object.entries(errorMessages).find(([key]) => errorMessage.includes(key))?.[1] ||
      'Purchase failed. Please try again.';

    setError(userMessage);
    setPurchaseInProgress(false);
    setLoading(false);

    AnalyticsService.trackError(error, {
      error_type: 'iap_error',
      error_message: errorMessage,
      user_message: userMessage,
      component: 'SubscriptionModal',
    });
  }, []);

  // Debug environment
  const debugEnvironment = useCallback(() => {
    const debugInfo = {
      'window.store': !!window.store,
      'window.store.register': typeof window.store?.register === 'function',
      'window.cordova': !!window.cordova,
      'window.Capacitor': !!window.Capacitor,
      'document.readyState': document.readyState,
      'User Agent': navigator.userAgent,
      'Platform': navigator.platform,
      'Network Status': navigator.onLine,
      'Products Loaded': products.length,
      'Initialized': initialized,
      'Capacitor Platform': window.Capacitor?.getPlatform?.(),
      'TestFlight': navigator.userAgent.includes('TestFlight'),
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

  // Parental gate handlers
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
    setShowParentalGate(false);
    AnalyticsService.trackEvent('parental_gate_passed');
  }, [pendingAction]);

  const handleParentalGateClose = useCallback(() => {
    setShowParentalGate(false);
    setPendingAction(null);
    AnalyticsService.trackEvent('parental_gate_cancelled');
  }, []);

  // Retry logic
  const withRetry = async (operation, operationName, maxRetries = MAX_RETRIES) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        AnalyticsService.trackEvent(`operation_attempt`, { operation: operationName, attempt, max_retries: maxRetries });
        const result = await operation();
        AnalyticsService.trackEvent(`operation_success`, { operation: operationName, attempt });
        return result;
      } catch (error) {
        AnalyticsService.trackError(error, { operation: operationName, attempt, max_retries: maxRetries });
        if (attempt === maxRetries) {
          throw error;
        }
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

  // FIXED: Enhanced IAP initialization
  const initializeIAP = async () => {
    AnalyticsService.trackEvent('iap_initialization_started');

    if (!checkNetworkStatus()) {
      setError('No internet connection. Please check your network and try again.');
      AnalyticsService.trackError(new Error('No internet connection'), { stage: 'network_check' });
      setInitialized(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔄 Starting IAP initialization process...');
      
      // Wait for Cordova to be ready with enhanced error handling
      InAppPurchase = await waitForCordova();

      if (!InAppPurchase || typeof InAppPurchase.register !== 'function') {
        throw new Error('In-App Purchase plugin not available or not properly initialized');
      }

      console.log('✅ Cordova Purchase plugin initialized successfully');

      // Set verbosity for production
      InAppPurchase.verbosity = InAppPurchase.DEBUG; // Use DEBUG for more logs during testing

      // Set up event handlers FIRST
      InAppPurchase.when('product').updated((product) => {
        console.log(`📦 Product ${product.id} updated:`, product.valid ? 'VALID' : 'INVALID');
        updateProductsList();
      });

      InAppPurchase.when(PRODUCT_IDS.monthly).approved((product) => {
        console.log('✅ Monthly subscription approved:', product);
        AnalyticsService.trackEvent('purchase_approved', { product_id: PRODUCT_IDS.monthly });
        finishPurchase(product);
      });

      InAppPurchase.when(PRODUCT_IDS.yearly).approved((product) => {
        console.log('✅ Yearly subscription approved:', product);
        AnalyticsService.trackEvent('purchase_approved', { product_id: PRODUCT_IDS.yearly });
        finishPurchase(product);
      });

      InAppPurchase.error((error) => {
        console.error('❌ IAP Error event:', error);
        AnalyticsService.trackEvent('purchase_error_event', { error: error.message });
        handleIAPError(error);
      });

      // Register products
      console.log('📝 Registering products...');
      InAppPurchase.register([
        {
          id: PRODUCT_IDS.monthly,
          type: InAppPurchase.PAID_SUBSCRIPTION,
        },
        {
          id: PRODUCT_IDS.yearly,
          type: InAppPurchase.PAID_SUBSCRIPTION,
        },
      ]);

      console.log('✅ Products registered');

      // Refresh to load product details
      console.log('🔄 Refreshing products...');
      await InAppPurchase.refresh();
      console.log('✅ Products refreshed');

      // Wait a moment for products to load, then update UI
      setTimeout(() => {
        updateProductsList();
        setInitialized(true);
        console.log('🎉 IAP initialization completed successfully');
        AnalyticsService.trackEvent('iap_initialization_success');
      }, 2000);

    } catch (err) {
      console.error('❌ IAP Initialization error:', err);
      
      // More specific error messages - NO TECHNICAL DETAILS
      let errorMessage;
      if (err.message.includes('timeout')) {
        errorMessage = 'Payment system is taking longer than expected. Please try again.';
      } else if (err.message.includes('native')) {
        errorMessage = 'In-app purchases are only available in the app version from the App Store.';
      } else {
        errorMessage = 'Unable to initialize payment system. Please try again later.';
      }
      
      setError(errorMessage);
      AnalyticsService.trackError(err, { stage: 'initialization' });
      setInitialized(true); // Mark as initialized even if failed to prevent infinite loading
    } finally {
      setLoading(false);
    }
  };

  const updateProductsList = useCallback(() => {
    try {
      if (!InAppPurchase) {
        console.warn('⚠️ InAppPurchase not available for product update');
        return;
      }

      const monthlyProduct = InAppPurchase.get(PRODUCT_IDS.monthly);
      const yearlyProduct = InAppPurchase.get(PRODUCT_IDS.yearly);
      const availableProducts = [monthlyProduct, yearlyProduct].filter(p => p && p.valid);
      setProducts(availableProducts);

      console.log('📦 Available products:', availableProducts.map(p => ({
        id: p.id,
        valid: p.valid,
        price: p.price,
        title: p.title
      })));
      
      AnalyticsService.trackEvent('products_updated', {
        available_count: availableProducts.length,
        monthly_available: !!monthlyProduct?.valid,
        yearly_available: !!yearlyProduct?.valid,
      });

      if (availableProducts.length === 0 && initialized) {
        console.warn('⚠️ No valid products available');
        setError('No subscription plans available. Please try again later.');
        AnalyticsService.trackEvent('no_products_available');
      }
    } catch (err) {
      console.error('❌ Error updating products list:', err);
      AnalyticsService.trackError(err, { stage: 'update_products_list' });
      setError('Failed to load subscription plans. Please try again.');
    }
  }, [initialized]);

  const finishPurchase = async (product) => {
    try {
      console.log('🏁 Finishing purchase:', product);
      AnalyticsService.trackEvent('purchase_finishing', { product_id: product.id });

      // Finish the purchase to avoid billing issues
      await product.finish();
      AnalyticsService.trackEvent('purchase_finished', { product_id: product.id });

      // Verify with backend using the new server logic
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
        console.error('❌ Purchase verification failed:', verificationResult);
        AnalyticsService.trackEvent('purchase_verification_failed', {
          product_id: product.id,
          error: verificationResult.error,
        });
        // USER-FRIENDLY ERROR ONLY - no technical details
        setError('Unable to verify purchase. Please contact support.');
      }
    } catch (err) {
      console.error('❌ Purchase completion error:', err);
      AnalyticsService.trackError(err, { stage: 'finish_purchase', product_id: product.id });
      // USER-FRIENDLY ERROR ONLY - no technical details
      setError('Failed to complete purchase. Please try again or contact support.');
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

    let receiptData;
    if (product.transaction?.appStoreReceipt) {
      receiptData = product.transaction.appStoreReceipt;
    } else if (product.transaction?.receipt) {
      receiptData = product.transaction.receipt;
    } else {
      try {
        receiptData = await InAppPurchase.getReceipt();
      } catch (err) {
        console.error('❌ Failed to get receipt:', err);
        throw new Error('No receipt data found');
      }
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
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}`);
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

  const restorePurchases = async () => {
    if (!InAppPurchase) {
      setError('In-app purchases not available on this device');
      return;
    }

    if (!initialized) {
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
      console.log('🔄 Starting restore purchases...');
      await InAppPurchase.restore();
      console.log('✅ Restore purchases completed');
      
      AnalyticsService.trackEvent('restore_purchases_completed');
      setError('Purchases restored successfully. If you still don\'t have access, please contact support.');
    } catch (err) {
      console.error('❌ Restore purchases error:', err);
      AnalyticsService.trackError(err, { stage: 'restore_purchases' });
      setError('Failed to restore purchases. Please try again.');
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
      product_id: selectedPlan === 'monthly' ? PRODUCT_IDS.monthly : PRODUCT_IDS.yearly,
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

      console.log('🛒 Initiating purchase for:', productId);
      await InAppPurchase.order(productId);
    } catch (err) {
      console.error('❌ Purchase initiation error:', err);
      AnalyticsService.trackError(err, { stage: 'purchase_initiation', plan: selectedPlan });
      setError(err.message || 'Failed to start purchase. Please try again.');
      setPurchaseInProgress(false);
      setLoading(false);
    }
  };

  // FIXED: Conspicuous pricing display - BOLD AMOUNT FIRST, then period
  const getProductPrice = useCallback((productId) => {
    const product = products.find(p => p.id === productId);
    if (product && product.price) {
      // Extract the amount and period for proper formatting
      const price = product.price;
      // Format: "AMOUNT PERIOD" with amount being most prominent
      return price;
    }
    return FALLBACK_PRICES[productId.includes('monthly') ? 'monthly' : 'yearly'];
  }, [products]);

  // NEW: Get just the amount part for bold display
  const getPriceAmount = useCallback((productId) => {
    const fullPrice = getProductPrice(productId);
    // Extract just the amount part (before any space or slash)
    const amountMatch = fullPrice.match(/^[^\s\/]+/);
    return amountMatch ? amountMatch[0] : fullPrice;
  }, [getProductPrice]);

  // NEW: Get just the period part for smaller display
  const getPricePeriod = useCallback((productId) => {
    const fullPrice = getProductPrice(productId);
    // Extract everything after the amount
    const amount = getPriceAmount(productId);
    return fullPrice.replace(amount, '').trim();
  }, [getProductPrice, getPriceAmount]);

  const getProductTitle = useCallback((productId) => {
    const product = products.find(p => p.id === productId);
    if (product && product.title) {
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
        dialogClassName="subscription-modal-fullscreen bg-transparent border-0"
        backdropClassName="custom-backdrop"
        centered
        scrollable={false}
      >
        <Modal.Header closeButton className="border-0 modal-header-fixed">
        </Modal.Header>

        <Modal.Body className="d-flex flex-column justify-content-between align-items-center text-white modal-body-fullscreen">
            <h3 className="text-white w-100 text-center mt-3 mb-5">
            Subscribe to Sara Stories</h3>
            <ul className="list-unstyled text-center mb-3 benefits-list">
              <li><BsMoonStarsFill className="benefits-icon" /> Peaceful and restful sleep for your child</li>
              <li><BsMoonStarsFill className="benefits-icon" /> More than 3000 illustrations</li>
              <li><BsMoonStarsFill className="benefits-icon" /> Cancel anytime</li>
            </ul>

          <div className="flex-grow-1 d-flex flex-column justify-content-center w-100">
            <div style={{ height: "24px" }}></div>

            <Row className="w-100 justify-content-center">
              <Col xs={12} md={8} lg={6}>
                <h5 className="mb-4 text-white text-center">Select Plan</h5>

                {/* Monthly Plan - FIXED CONSPICUOUS PRICING */}
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
                      {/* BOLD AMOUNT FIRST - Most conspicuous */}
                      <span className="text-white fw-bold fs-4 me-1">
                        {getPriceAmount(PRODUCT_IDS.monthly)}
                      </span>
                      {/* Period in smaller font */}
                      <span className="text-white-50 fs-6">
                        {getPricePeriod(PRODUCT_IDS.monthly)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Yearly Plan - FIXED CONSPICUOUS PRICING */}
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
                      {/* BOLD AMOUNT FIRST - Most conspicuous */}
                      <span className="text-white fw-bold fs-4 me-1">
                        {getPriceAmount(PRODUCT_IDS.yearly)}
                      </span>
                      {/* Period in smaller font */}
                      <span className="text-white-50 fs-6">
                        {getPricePeriod(PRODUCT_IDS.yearly)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Network Status - Subtle indicator */}
                {!networkStatus && (
                  <div className="mt-3 text-center">
                    <small className="text-warning">⚠️ No internet connection</small>
                  </div>
                )}

                {/* Error Display - USER FRIENDLY ONLY */}
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