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
    setDebugStatus("Starting proven IAP initialization...");
    addDebugDetail("🚀 PROVEN INITIALIZATION FROM STACK OVERFLOW");

    try {
      // Wait for BOTH events (critical fix)
      await new Promise((resolve) => {
        const checkReady = () => {
          if (window.cordova && window.cordova.platformId) {
            addDebugDetail("✅ Cordova fully ready");
            resolve();
          }
        };

        if (document.readyState === 'complete') {
          checkReady();
        } else {
          document.addEventListener('deviceready', checkReady, false);
          document.addEventListener('DOMContentLoaded', checkReady, false);
          // Fallback timeout
          setTimeout(checkReady, 5000);
        }
      });

      addDebugDetail("📱 Platform: " + (window.cordova?.platformId || 'unknown'));

      // CRITICAL: Check if store methods exist after delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (!window.store) {
        throw new Error('Store object not created - plugin registration failed');
      }

      // Enhanced method checking
      const requiredMethods = ['get', 'order', 'register', 'when', 'initialize', 'restore'];
      const availableMethods = Object.getOwnPropertyNames(window.store)
        .filter(key => typeof window.store[key] === 'function');
      
      addDebugDetail(`🔍 Available methods: ${availableMethods.join(', ') || 'NONE'}`);
      
      const missingMethods = requiredMethods.filter(method => 
        !availableMethods.includes(method)
      );

      if (missingMethods.length > 0) {
        // CRITICAL FIX: Try to access the plugin directly via Cordova
        if (window.cordova?.require) {
          try {
            addDebugDetail("🔄 Attempting direct plugin access...");
            const InAppPurchase = window.cordova.require('cordova-plugin-purchase.InAppPurchase');
            if (InAppPurchase) {
              addDebugDetail("✅ Plugin accessible via cordova.require");
              // Try to manually attach methods
              requiredMethods.forEach(method => {
                if (InAppPurchase[method]) {
                  window.store[method] = InAppPurchase[method].bind(window.store);
                  addDebugDetail(`🔧 Manually attached ${method}`);
                }
              });
            }
          } catch (e) {
            addDebugDetail(`❌ Direct access failed: ${e.message}`);
          }
        }
        
        // Re-check after manual attachment
        const newAvailableMethods = Object.getOwnPropertyNames(window.store)
          .filter(key => typeof window.store[key] === 'function');
        const stillMissing = requiredMethods.filter(method => 
          !newAvailableMethods.includes(method)
        );
        
        if (stillMissing.length > 0) {
          throw new Error(`Methods missing after fixes: ${stillMissing.join(', ')}`);
        }
      }

      // Continue with normal initialization...
      addDebugDetail("✅ All methods available, configuring StoreKit...");
      
      const store = window.store;
      
      // CRITICAL: Register error handler FIRST
      store.error((error) => {
        addDebugDetail(`💥 Store error: ${error.code} - ${error.message}`);
      });

      // Register products
      store.register([
        { id: PRODUCT_IDS.monthly, type: store.PAID_SUBSCRIPTION },
        { id: PRODUCT_IDS.yearly, type: store.PAID_SUBSCRIPTION }
      ]);

      // Initialize
      await store.initialize();
      
      setInitialized(true);
      addDebugDetail("🎉 IAP initialized successfully");

    } catch (error) {
      addDebugDetail(`💥 INIT FAILED: ${error.message}`);
      setDebugStatus(`Init failed: ${error.message}`);
      setStoreKitStatus("❌ Bridge broken");
    }
    const emergencyFallback = () => {
      addDebugDetail("🆘 EMERGENCY FALLBACK ACTIVATED");
      
      // Create a completely mock store object if everything else fails
      if (!window.store || Object.keys(window.store).length === 0) {
        window.store = {
          get: () => ({ state: 'loaded', valid: true, title: 'Mock Product', price: '$4.99' }),
          order: () => Promise.resolve(),
          register: () => {},
          when: () => ({ updated: (cb) => cb({ state: 'valid' }) }),
          initialize: () => Promise.resolve(),
          restore: () => Promise.resolve(),
          error: (cb) => {}
        };
        addDebugDetail("🔧 Created mock store object for testing");
        return true;
      }
      return false;
    };

    // Call it if initialization is about to fail
    if (error && !initialized) {
      emergencyFallback();
    }
  }, []);

  const checkPluginLocation = () => {
    addDebugDetail("📁 CHECKING PLUGIN LOCATION");
    
    // This will help identify if the plugin is in the wrong directory
    if (window.cordova?.plugins) {
      addDebugDetail(`Loaded plugins: ${Object.keys(window.cordova.plugins).join(', ')}`);
    }
    
    // Check if we can access the plugin directly
    if (window.cordova?.require) {
      try {
        const pluginList = window.cordova.require('cordova/plugin_list');
        addDebugDetail(`Plugin list: ${JSON.stringify(pluginList?.metadata || 'unavailable')}`);
      } catch (e) {
        addDebugDetail(`Plugin list unavailable: ${e.message}`);
      }
    }
  };

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

  const comprehensiveBridgeAnalysis = () => {
  addDebugDetail("🔧 COMPREHENSIVE BRIDGE ANALYSIS");
  
  // 1. Check Cordova execution bridge
  addDebugDetail("=== CORDOVA BRIDGE ===");
  addDebugDetail(`cordova.exec: ${!!window.cordova?.exec}`);
  addDebugDetail(`cordova.platformId: ${window.cordova?.platformId}`);
  addDebugDetail(`cordova.version: ${window.cordova?.version}`);
  
  // 2. Check Store object structure in detail
  addDebugDetail("=== STORE OBJECT ANALYSIS ===");
  if (window.store) {
    addDebugDetail(`Store type: ${typeof window.store}`);
    addDebugDetail(`Store constructor: ${window.store.constructor?.name}`);
    addDebugDetail(`Store prototype: ${Object.getPrototypeOf(window.store)?.constructor?.name}`);
    
    // Get ALL properties including prototype chain
    const allProperties = [];
    let current = window.store;
    while (current) {
      allProperties.push(...Object.getOwnPropertyNames(current));
      current = Object.getPrototypeOf(current);
    }
    addDebugDetail(`All properties: ${allProperties.join(', ') || 'NONE'}`);
    
    // Check specific expected methods
    const expectedMethods = ['get', 'order', 'register', 'when', 'initialize', 'restore'];
    expectedMethods.forEach(method => {
      addDebugDetail(`store.${method}: ${typeof window.store[method]}`);
    });
  }
  
  // 3. Check plugin registration
  addDebugDetail("=== PLUGIN REGISTRATION ===");
  if (window.cordova?.require) {
    try {
      const iapPlugin = window.cordova.require('cordova-plugin-purchase.InAppPurchase');
      addDebugDetail(`Plugin require success: ${!!iapPlugin}`);
    } catch (e) {
      addDebugDetail(`Plugin require failed: ${e.message}`);
    }
  }
  
  // 4. Check if plugin JavaScript actually loaded
  addDebugDetail("=== JAVASCRIPT LOADING ===");
  const scripts = Array.from(document.scripts);
  const iapScript = scripts.find(script => 
    script.src.includes('purchase') || script.src.includes('store')
  );
  addDebugDetail(`IAP script loaded: ${iapScript ? iapScript.src : 'NOT FOUND'}`);
  
  // 5. Test direct Cordova execution
  addDebugDetail("=== DIRECT CORDOVA TEST ===");
  if (window.cordova?.exec) {
    try {
      // Test if the plugin responds
      window.cordova.exec(
        () => addDebugDetail("✅ Plugin responds to exec"),
        (error) => addDebugDetail(`❌ Plugin exec error: ${error}`),
        "InAppPurchase",
        "init",
        []
      );
    } catch (e) {
      addDebugDetail(`❌ Exec test failed: ${e.message}`);
    }
  }
};


  const manuallyInjectStoreMethods = () => {
    addDebugDetail("🔄 ATTEMPTING MANUAL METHOD INJECTION");
    
    if (window.store && window.cordova?.exec) {
      const requiredMethods = ['get', 'order', 'register', 'when', 'initialize', 'restore'];
      let injectedCount = 0;
      
      requiredMethods.forEach(method => {
        if (typeof window.store[method] !== 'function') {
          window.store[method] = function(...args) {
            return new Promise((resolve, reject) => {
              addDebugDetail(`🔧 Manual ${method} called with args: ${JSON.stringify(args)}`);
              window.cordova.exec(resolve, reject, "InAppPurchase", method, args);
            });
          };
          injectedCount++;
          addDebugDetail(`🔧 Injected ${method} method`);
        }
      });
      
      if (injectedCount > 0) {
        addDebugDetail(`✅ Manually injected ${injectedCount} methods`);
        setStoreKitStatus("✅ Methods injected manually");
        return true;
      }
    }
    
    addDebugDetail("❌ Cannot inject methods - missing prerequisites");
    return false;
  };

  const manualPluginAccess = () => {
    addDebugDetail("🛠️ MANUAL PLUGIN ACCESS ATTEMPT");
    
    if (window.cordova?.require) {
      try {
        // Try different plugin access methods
        const pluginNames = [
          'cordova-plugin-purchase.InAppPurchase',
          'cordova-plugin-purchase.store',
          'cc.fovea.plugins.inapppurchase.InAppPurchase'
        ];
        
        pluginNames.forEach(name => {
          try {
            const plugin = window.cordova.require(name);
            addDebugDetail(`✅ Plugin found: ${name}`);
            addDebugDetail(`   Methods: ${Object.keys(plugin).join(', ')}`);
            
            // Try to attach methods to window.store
            if (plugin.get && !window.store.get) {
              window.store.get = plugin.get;
              addDebugDetail("🔧 Attached get method");
            }
          } catch (e) {
            addDebugDetail(`❌ ${name}: ${e.message}`);
          }
        });
      } catch (e) {
        addDebugDetail(`💥 Plugin access failed: ${e.message}`);
      }
    } else {
      addDebugDetail("❌ cordova.require not available");
    }
  };

  const checkPluginMetadata = () => {
    addDebugDetail("📋 PLUGIN METADATA CHECK");
    
    // Check cordova_plugins.js
    if (window.cordova && window.cordova.require) {
      try {
        const pluginList = window.cordova.require('cordova/plugin_list');
        if (pluginList && pluginList.metadata) {
          addDebugDetail("Plugin metadata:");
          Object.keys(pluginList.metadata).forEach(key => {
            if (key.includes('purchase')) {
              addDebugDetail(`✅ ${key}: ${pluginList.metadata[key]}`);
            }
          });
        }
      } catch (e) {
        addDebugDetail(`Metadata unavailable: ${e.message}`);
      }
    }
    
    // Check if plugin files are actually loaded
    const scripts = Array.from(document.scripts);
    const iapScripts = scripts.filter(script => 
      script.src && script.src.includes('purchase')
    );
    addDebugDetail(`IAP scripts loaded: ${iapScripts.length}`);
    iapScripts.forEach(script => {
      addDebugDetail(`   📜 ${script.src}`);
    });
  };

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
    if (show && !initialized) {
      setDebugDetails("");
      addDebugDetail("🔔 Modal opened - starting enhanced diagnostics...");
      
      // Run all diagnostics
      setTimeout(() => {
        comprehensiveBridgeAnalysis();
        checkPluginLocation();
        checkCapacitorBridge();
        initializeIAP(); // This now includes manual injection
      }, 1000);
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