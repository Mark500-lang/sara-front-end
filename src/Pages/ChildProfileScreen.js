import React, { useState, useEffect } from "react";
import { Button }        from "react-bootstrap";
import { useNavigate }   from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Browser }       from '@capacitor/browser';
import { Device }        from '@capacitor/device';
import { MdCancel }      from 'react-icons/md';

import boyImage  from "../assets/screen-1/Boy.png";
import girlImage from "../assets/screen-1/Girl.png";
import emailIcon from "../assets/Email Icon.png";
import musicIcon from "../assets/Music Icon.png";
import "./ChildProfileScreen.css";

import { tokenManager }       from "../utils/tokenManager";
import { initDeviceIdentity } from "../utils/deviceIdentity";

const API_BASE_URL = 'https://kithia.com/website_b5d91c8e/api';

const ChildProfileScreen = () => {
  const navigate = useNavigate();

  const [isLoading,  setIsLoading]  = useState(false);
  const [showModal,  setShowModal]  = useState(false);
  const [updateData, setUpdateData] = useState(null);
  // Start true so the spinner shows while we bootstrap
  const [isChecking, setIsChecking] = useState(true);
  // Human-readable status shown under the spinner during dev
  const [setupStatus, setSetupStatus] = useState('Starting up…');

  // ── Bootstrap — runs once on mount ─────────────────────────────────────────
  // Order matters:
  //   1. initDeviceIdentity  → UUID + Sanctum token guaranteed before anything else
  //   2. checkVersion        → non-blocking, safe to fail
  //
  // Promise.allSettled is used so a version-check failure never prevents
  // the spinner from clearing.

  useEffect(() => {
    let alive = true; // prevent state updates after unmount

    const bootstrap = async () => {
      // ── 1. Device identity (UUID + backend token) ─────────────────────────
      // This is the most important step. Everything else depends on a token.
      setSetupStatus('Setting up your account…');
      try {
        await initDeviceIdentity(tokenManager);
        if (alive) setSetupStatus('Account ready.');
      } catch (err) {
        // initDeviceIdentity catches its own errors internally and never throws,
        // but guard here as a safety net just in case.
        console.error('[ChildProfileScreen] initDeviceIdentity threw:', err.message);
        if (alive) setSetupStatus('Setup had an issue — continuing anyway.');
      }

      // ── 2. Version check (fire-and-forget, non-blocking) ──────────────────
      setSetupStatus('Checking for updates…');
      await checkVersion(); // has its own internal try/catch

      // ── 3. Done — always clear the spinner ────────────────────────────────
      if (alive) {
        setSetupStatus('Done.');
        setIsChecking(false);
      }
    };

    bootstrap();
    return () => { alive = false; };
  }, []);

  // ── Version check ───────────────────────────────────────────────────────────
  const checkVersion = async () => {
    try {
      let platform = 'web';
      let version  = '1.1.0';

      try {
        const info = await Device.getInfo();
        platform = info.platform === 'ios'     ? 'ios'
                 : info.platform === 'android' ? 'android'
                 : 'web';
      } catch {}

      try {
        const appInfo = await window.Capacitor?.Plugins?.App?.getInfo?.();
        version = appInfo?.version || version;
      } catch {}

      const controller = new AbortController();
      const timeout    = setTimeout(() => controller.abort(), 6000);

      let response;
      try {
        response = await fetch(`${API_BASE_URL}/check-version`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          signal:  controller.signal,
          body:    JSON.stringify({ version, platform }),
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) throw new Error(`check-version ${response.status}`);

      const json = await response.json();

      if (json.status === 'ok' && json.result?.code === 1) {
        setUpdateData({
          title:   json.result.title,
          message: json.result.message,
          url:     json.result.url,
          force:   json.result.force,
        });
        setShowModal(true);
      }
    } catch (err) {
      // AbortError = timed out. Network error = offline.
      // Both are non-fatal — the app works fine without this check.
      if (err.name !== 'AbortError') {
        console.warn('[ChildProfileScreen] Version check failed (non-fatal):', err.message);
      }
    }
  };

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleUpdate = async () => {
    if (updateData?.url) {
      try { await Browser.open({ url: updateData.url }); } catch {}
    }
    setShowModal(false);
  };

  const closeModal = () => {
    if (updateData?.force !== 1) setShowModal(false);
  };

  // Called when user taps "Continue"
  // By this point initDeviceIdentity has already run, so we almost certainly
  // have a token. The hasToken check is a safety net for edge cases only.
  const handleContinue = async () => {
    setIsLoading(true);
    try {
      const hasToken = await tokenManager.hasToken();
      if (!hasToken) {
        console.warn('[ChildProfileScreen] No token at Continue — re-running init.');
        await initDeviceIdentity(tokenManager);
      }
      navigate('/home');
    } catch (err) {
      console.error('[ChildProfileScreen] handleContinue error:', err.message);
      navigate('/home'); // Never block the user
    } finally {
      setIsLoading(false);
    }
  };

  // ── Animation variants (all unchanged from original) ────────────────────────
  const containerVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.5, staggerChildren: 0.2 } },
  };
  const topItemVariants = {
    initial: { opacity: 0, y: -50 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };
  const boyImageVariants = {
    initial: { y: '100vh', opacity: 0 },
    animate: { y: 0, opacity: 1, transition: { duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.3 } },
  };
  const girlImageVariants = {
    initial: { y: '100vh', opacity: 0 },
    animate: { y: 0, opacity: 1, transition: { duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.3 } },
  };
  const backdropVariants = {
    hidden:  { opacity: 0 },
    visible: { opacity: 1 },
    exit:    { opacity: 0 },
  };
  const modalVariants = {
    hidden:  { opacity: 0, y: 50 },
    visible: { opacity: 1, y: 0 },
    exit:    { opacity: 0, y: 50 },
  };

  // ── Loading state ────────────────────────────────────────────────────────────
  if (isChecking) {
    return (
      <div
        className="d-flex flex-column justify-content-center align-items-center vh-100"
        style={{ gap: 12 }}
      >
        <div className="spinner-border text-white" role="status">
          <span className="visually-hidden">Loading…</span>
        </div>
        {/* Status text — useful during dev to see exactly what step is running.
            Remove or hide behind a DEV flag before App Store submission if preferred. */}
        <small style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
          {setupStatus}
        </small>
      </div>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────────
  return (
    <>
      <motion.div
        className="child-profile-main-container"
        variants={containerVariants}
        initial="initial"
        animate="animate"
      >
        <motion.div className="profile-header-icons text-white" variants={topItemVariants}>
          <img src={emailIcon} alt="Email icon" onClick={() => navigate('/home')} />
          <img src={musicIcon} alt="Music Icon" />
        </motion.div>

        <div className="child-profile-content">
          <div className="child-profile-container text-center mb-3">

            <motion.div
              className="child-illustration-1-container"
              variants={boyImageVariants}
              initial="initial"
              animate="animate"
            >
              <img src={boyImage} alt="boy image" className="child-illustration-1" />
            </motion.div>

            <div className="continue-child-section mt-3">
              <div className="continue-child-section-header">
                <h4 className="text-center profile-header-text">Little stories from</h4>
                <h4 className="text-center profile-header-text">little Sara.</h4>
              </div>
              <Button
                onClick={handleContinue}
                className="continue-child-btn"
                disabled={isLoading}
              >
                {isLoading ? 'Loading…' : 'Continue'}
              </Button>
            </div>

            <motion.div
              className="child-illustration-2-container"
              variants={girlImageVariants}
              initial="initial"
              animate="animate"
            >
              <img src={girlImage} alt="girl image" className="child-illustration-2" />
            </motion.div>

          </div>
        </div>
      </motion.div>

      {/* Update modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            className="modal-backdrop"
            variants={backdropVariants}
            initial="hidden" animate="visible" exit="exit"
            onClick={updateData?.force === 1 ? undefined : closeModal}
          >
            <motion.div
              className="modal-dialog modal-dialog-centered"
              role="document"
              variants={modalVariants}
              initial="hidden" animate="visible" exit="exit"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="version-popup-content">
                <div className="popup-modal-body">
                  {updateData?.force !== 1 && (
                    <MdCancel className="custom-btn-cancel" onClick={closeModal} />
                  )}
                  <h5 className="version-popup-title">{updateData?.title}</h5>
                  <p  className="version-popup-message">{updateData?.message}</p>
                  <div className="version-popup-btns">
                    {updateData?.force !== 1 && (
                      <motion.div
                        className="version-popup-btn-yes"
                        onClick={closeModal}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <p>Later</p>
                      </motion.div>
                    )}
                    <motion.div
                      className="version-popup-btn-yes"
                      onClick={handleUpdate}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <p>Update Now</p>
                    </motion.div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ChildProfileScreen;