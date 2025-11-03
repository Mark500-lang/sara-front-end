import { useState, useEffect, useCallback } from "react";
import "./SubscriptionModal.css";
import { BsMoonStarsFill } from "react-icons/bs";
import { Modal, Button, Form, Spinner, Row, Col } from "react-bootstrap";
import ParentalGateModal from "./ParentalGateModal";

// Initialize the purchase plugin
let InAppPurchase = null;

// Production constants
const MAX_RETRIES = 3;
const NETWORK_TIMEOUT = 15000;
const PURCHASE_TIMEOUT = 45000;

// PRODUCTION-READY StoreKit initialization
const waitForCordova = () => {
  return new Promise((resolve, reject) => {
    console.log('🔄 Starting PRODUCTION StoreKit initialization...');
    
    // Check if we're in a native environment
    const isNative = window.cordova || window.Capacitor?.isNativePlatform;
    if (!isNative) {
      reject(new Error('Not in native app environment'));
      return;
    }

    console.log('📱 Native environment detected');

    // Multiple strategies to find the real store
    const getStore = () => {
      // Strategy 1: Direct access (most common)
      if (window.store && typeof window.store.register === 'function') {
        console.log('✅ Store available via direct access');
        return window.store;
      }
      
      // Strategy 2: Cordova plugins object
      if (window.cordova?.plugins?.inapppurchase) {
        console.log('✅ Store available via cordova.plugins');
        return window.cordova.plugins.inapppurchase;
      }
      
      // Strategy 3: Global purchase object
      if (window.purchase && typeof window.purchase.register === 'function') {
        console.log('✅ Store available via window.purchase');
        return window.purchase;
      }
      
      return null;
    };

    // Check immediately
    const store = getStore();
    if (store) {
      console.log('🎉 Real StoreKit found immediately');
      resolve(store);
      return;
    }

    let resolved = false;
    const maxWaitTime = 10000;
    const startTime = Date.now();

    const succeed = (storeInstance) => {
      if (resolved) return;
      resolved = true;
      console.log(`✅ Real StoreKit initialized after ${Date.now() - startTime}ms`);
      resolve(storeInstance);
    };

    const fail = (error) => {
      if (resolved) return;
      resolved = true;
      console.error(`❌ Real StoreKit initialization failed: ${error.message}`);
      reject(error);
    };

    // Event listeners for real StoreKit
    const onDeviceReady = () => {
      console.log('📱 deviceready event received');
      checkForStore();
    };

    const onPurchasesReady = () => {
      console.log('🛒 purchasesReady event received');
      checkForStore();
    };

    const checkForStore = () => {
      const store = getStore();
      if (store) {
        succeed(store);
        return true;
      }
      return false;
    };

    // Listen for real Cordova events
    document.addEventListener('deviceready', onDeviceReady, { once: true });
    document.addEventListener('purchasesReady', onPurchasesReady, { once: true });

    // Periodic checking for real store
    const checkInterval = setInterval(() => {
      if (checkForStore()) {
        clearInterval(checkInterval);
        clearTimeout(failTimeout);
      }
      
      if (Date.now() - startTime > maxWaitTime) {
        clearInterval(checkInterval);
        fail(new Error(`Real StoreKit not available after ${maxWaitTime}ms`));
      }
    }, 500);

    // Final timeout
    const failTimeout = setTimeout(() => {
      clearInterval(checkInterval);
      fail(new Error('Real StoreKit initialization timeout'));
    }, maxWaitTime + 2000);

    // Initial check
    checkForStore();
  });
};

// Fallback product data (ONLY for UI display, not for purchases)
const FALLBACK_PRODUCTS = {
  monthly: {
    id: 'com.littlestories.app.premiummonthly',
    title: 'Premium Monthly Subscription',
    price: '$4.99',
    period: '/month',
    description: 'Billed monthly'
  },
  yearly: {
    id: 'com.littlestories.app.premiumyearly', 
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
  const [storeAvailable, setStoreAvailable] = useState(false);

  const PRODUCT_IDS = {
    monthly: 'com.littlestories.app.premiummonthly',
    yearly: 'com.littlestories.app.premiumyearly',
  };

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

  useEffect(() => {
    if (show && !initialized) {
      initializeIAP();
    }
  }, [show, initialized]);

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

  // PRODUCTION IAP initialization with real StoreKit
  const initializeIAP = async () => {
    console.log('🚀 Starting REAL IAP initialization...');
    
    AnalyticsService.trackEvent('iap_initialization_started');

    if (!checkNetworkStatus()) {
      setError('No internet connection. Please check your network and try again.');
      setInitialized(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Wait for REAL StoreKit only
      InAppPurchase = await waitForCordova();
      setStoreAvailable(true);

      console.log('✅ Real StoreKit acquired');

      // Set verbosity for debugging
      InAppPurchase.verbosity = InAppPurchase.DEBUG;

      // Set up global error handler
      InAppPurchase.error((error) => {
        console.error('❌ IAP Global Error:', error);
        if (!error.message.includes('cancelled')) {
          handleIAPError(error);
        }
      });

      // Register REAL products with StoreKit
      console.log('📝 Registering REAL products with StoreKit...');
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

      console.log('✅ Real products registered');

      // Set up REAL purchase approval handlers
      InAppPurchase.when(PRODUCT_IDS.monthly).approved((product) => {
        console.log('✅ Monthly subscription approved via REAL StoreKit');
        AnalyticsService.trackEvent('purchase_approved', { product_id: PRODUCT_IDS.monthly });
        finishPurchase(product);
      });

      InAppPurchase.when(PRODUCT_IDS.yearly).approved((product) => {
        console.log('✅ Yearly subscription approved via REAL StoreKit');
        AnalyticsService.trackEvent('purchase_approved', { product_id: PRODUCT_IDS.yearly });
        finishPurchase(product);
      });

      // Set up product update handler
      InAppPurchase.when('product').updated((product) => {
        console.log(`📦 REAL Product ${product.id} updated:`, {
          valid: product.valid,
          state: product.state,
          canPurchase: product.canPurchase,
          price: product.price
        });
        updateProductsList();
      });

      // Refresh REAL products from Apple
      console.log('🔄 Refreshing REAL products from Apple...');
      try {
        await InAppPurchase.refresh();
        console.log('✅ Real products refreshed from Apple');
      } catch (refreshError) {
        console.warn('⚠️ Product refresh had issues (normal for unapproved products):', refreshError.message);
        // Continue anyway - products might be unapproved but purchase can still be attempted
      }

      // Wait for products to load and update UI
      setTimeout(() => {
        validateProductsAndUpdateUI();
      }, 2000);

    } catch (err) {
      console.error('❌ REAL IAP Initialization failed:', err);
      
      // REAL StoreKit is required - show appropriate error
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
      setInitialized(true);
      setLoading(false);
    }
  };

  // Update products list with REAL StoreKit products
  const validateProductsAndUpdateUI = () => {
    try {
      if (!InAppPurchase) {
        console.warn('⚠️ Real StoreKit not available for product update');
        setInitialized(true);
        setLoading(false);
        return;
      }

      const monthlyProduct = InAppPurchase.get(PRODUCT_IDS.monthly);
      const yearlyProduct = InAppPurchase.get(PRODUCT_IDS.yearly);
      
      console.log('🔍 REAL Product Validation:', {
        monthly: monthlyProduct ? {
          valid: monthlyProduct.valid,
          state: monthlyProduct.state,
          canPurchase: monthlyProduct.canPurchase,
          price: monthlyProduct.price,
          title: monthlyProduct.title
        } : 'NOT FOUND',
        yearly: yearlyProduct ? {
          valid: yearlyProduct.valid,
          state: yearlyProduct.state,
          canPurchase: yearlyProduct.canPurchase,
          price: yearlyProduct.price,
          title: yearlyProduct.title
        } : 'NOT FOUND'
      });

      // Use REAL StoreKit products if available, otherwise fallback for UI only
      const realProducts = [monthlyProduct, yearlyProduct].filter(p => p !== null && p !== undefined);
      
      if (realProducts.length > 0) {
        setProducts(realProducts);
        console.log('✅ Using REAL StoreKit products');
      } else {
        // Fallback to UI-only products (NOT for purchases)
        setProducts([FALLBACK_PRODUCTS.monthly, FALLBACK_PRODUCTS.yearly]);
        console.log('⚠️ Using fallback products for UI only');
      }

      // Handle unapproved products (common during Apple review)
      const invalidProducts = realProducts.filter(p => !p?.valid);
      if (invalidProducts.length > 0) {
        console.log('ℹ️ Products are unapproved/waiting for review - THIS IS NORMAL');
        console.log('📝 Apple reviewers can test purchases with unapproved products');
      }

      setInitialized(true);
      console.log('🎉 REAL IAP initialization completed');
      AnalyticsService.trackEvent('iap_initialization_success', {
        real_products_count: realProducts.length,
        store_available: !!InAppPurchase
      });

    } catch (err) {
      console.error('❌ Product validation error:', err);
      setInitialized(true);
    } finally {
      setLoading(false);
    }
  };

  const updateProductsList = useCallback(() => {
    if (!InAppPurchase) return;

    try {
      const monthlyProduct = InAppPurchase.get(PRODUCT_IDS.monthly);
      const yearlyProduct = InAppPurchase.get(PRODUCT_IDS.yearly);
      
      const realProducts = [monthlyProduct, yearlyProduct].filter(p => p !== null && p !== undefined);
      if (realProducts.length > 0) {
        setProducts(realProducts);
      }

      AnalyticsService.trackEvent('products_updated', {
        real_products_count: realProducts.length
      });

    } catch (err) {
      console.error('❌ Error updating products list:', err);
    }
  }, []);

  // REAL purchase completion with StoreKit
  const finishPurchase = async (product) => {
    console.log('🏁 Finishing REAL purchase:', product.id);
    
    if (purchaseTimeoutId) {
      clearTimeout(purchaseTimeoutId);
      setPurchaseTimeoutId(null);
    }

    let verificationAttempted = false;
    
    try {
      AnalyticsService.trackEvent('purchase_finishing', { product_id: product.id });

      // Finish the REAL purchase with StoreKit
      await product.finish();
      AnalyticsService.trackEvent('purchase_finished', { product_id: product.id });

      verificationAttempted = true;

      // Verify with REAL backend
      const verificationResult = await withRetry(
        () => verifyReceipt(product),
        'receipt_verification'
      );

      if (verificationResult.valid) {
        console.log('✅ REAL Purchase verified successfully');
        AnalyticsService.trackEvent('purchase_verified_success', { product_id: product.id });
        onPaymentSuccess();
        onClose();
      } else {
        throw new Error(verificationResult.error || 'Verification failed');
      }

    } catch (err) {
      console.error('❌ REAL Purchase completion error:', err);
      
      let userMessage = 'Purchase completed but verification failed. Please contact support.';
      
      if (err.message.includes('timeout')) {
        userMessage = 'Purchase completed! Verification is taking longer than expected.';
      } else if (err.message.includes('network')) {
        userMessage = 'Purchase completed! Please check your internet connection for verification.';
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
          platform: 'ios',
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
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

  // REAL restore purchases
  const restorePurchases = async () => {
    if (!InAppPurchase) {
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
      await InAppPurchase.restore();
      setError('Purchases restored successfully. If you still don\'t have access, please contact support.');
    } catch (err) {
      setError('Failed to restore purchases. Please try again.');
    } finally {
      clearTimeout(restoreTimeout);
      setRestoring(false);
    }
  };

  // REAL purchase handler with StoreKit
  const handleSubscribe = async () => {
    if (!InAppPurchase) {
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
    const product = InAppPurchase.get(productId);

    if (!product) {
      setError('Selected subscription plan not found. Please try again.');
      return;
    }

    console.log('🛒 Starting REAL purchase with StoreKit:', {
      productId,
      valid: product.valid,
      state: product.state,
      canPurchase: product.canPurchase,
      price: product.price
    });

    // ALLOW purchase attempts even for unapproved products (Apple review scenario)
    if (!product.valid) {
      console.warn('⚠️ Product is invalid/unapproved - allowing REAL purchase attempt');
      // Apple reviewers test with unapproved products - this is expected!
    }

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
      product_state: product.state
    });

    // Purchase timeout protection
    const timeoutId = setTimeout(() => {
      console.error('❌ REAL Purchase timeout');
      setError('Purchase timed out. Please try again.');
      setPurchaseInProgress(false);
      setLoading(false);
      setPurchaseTimeoutId(null);
    }, PURCHASE_TIMEOUT);

    setPurchaseTimeoutId(timeoutId);

    try {
      console.log('🛒 Initiating REAL purchase with Apple StoreKit...');
      
      // REAL StoreKit purchase call
      await InAppPurchase.order(productId);
      
      console.log('✅ REAL Purchase initiated successfully - waiting for Apple approval');
      // Loading state will be cleared in finishPurchase()
      
    } catch (err) {
      console.error('❌ REAL Purchase initiation failed:', err);
      
      // GUARANTEED cleanup
      clearTimeout(timeoutId);
      setPurchaseTimeoutId(null);
      setPurchaseInProgress(false);
      setLoading(false);
      
      let userMessage = 'Failed to start purchase. Please try again.';
      
      if (err.message.includes('cancelled')) {
        userMessage = 'Purchase was cancelled.';
      } else if (err.message.includes('network')) {
        userMessage = 'Network error. Please check your connection and try again.';
      } else if (err.message.includes('already')) {
        userMessage = 'You already own this subscription.';
      }
      
      setError(userMessage);
    }
  };

  // Product display functions - use REAL StoreKit data when available
  const getProductPrice = useCallback((productId) => {
    const realProduct = products.find(p => p.id === productId);
    if (realProduct && realProduct.price) {
      return realProduct.price;
    }
    // Fallback for UI only
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
    // Fallback for UI only
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
                {/* Network Status */}
                {!networkStatus && (
                  <div className="mt-3 text-center">
                    <small className="text-warning">⚠️ No internet connection</small>
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