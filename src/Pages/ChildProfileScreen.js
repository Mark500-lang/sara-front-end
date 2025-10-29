import React, { useState, useEffect } from "react";
import { Card, Button, Form, Row, Col } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { Device } from '@capacitor/device';
import { Browser } from '@capacitor/browser';
import { MdCancel } from 'react-icons/md';

import boyImage from "../assets/screen-1/Boy.png";
import girlImage from "../assets/screen-1/Girl.png";
import boyGenderIcon from "../assets/screen-1/Boy Icon.png";
import girlGenderIcon from "../assets/screen-1/Girl Icon.png";
import emailIcon from "../assets/Email Icon.png";
import musicIcon from "../assets/Music Icon.png";
import "./ChildProfileScreen.css";
import { tokenManager } from "../utils/tokenManager"; 

const ChildProfileScreen = () => {
  const navigate = useNavigate();
  const [childName, setChildName] = useState("");
  const [gender, setGender] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [updateData, setUpdateData] = useState(null);
  const [isChecking, setIsChecking] = useState(true);

  const API_BASE_URL = 'https://kithia.com/website_b5d91c8e/api';

  // Load profile data from localStorage
  useEffect(() => {
    const storedName = localStorage.getItem("childName");
    const storedGender = localStorage.getItem("gender");

    if (storedName) setChildName(storedName);
    if (storedGender) setGender(storedGender);
  }, []);

  const checkVersion = async () => {
    setIsChecking(true);
    try {
      const deviceInfo = await Device.getInfo();
      const platformStr = deviceInfo.platform === 'ios' ? 'ios' : 
                         deviceInfo.platform === 'android' ? 'android' : 
                         'web'; // Fallback to 'web'
      let version = '1.0.6'; // Default; in full hook, use App.getInfo().version
      try {
        const appInfo = await window.Capacitor.Plugins.App.getInfo?.();
        version = appInfo?.version || version;
      } catch {}

      const requestBody = {
        version,
        platform: platformStr,
      };

      const response = await fetch(`${API_BASE_URL}/check-version`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error('Network error');
      }

      const json = await response.json();

      if (json.status === 'ok' && json.result && json.result.code === 1) {
        setUpdateData({
          title: json.result.title,
          message: json.result.message,
          url: json.result.url,
          force: json.result.force,
        });
        setShowModal(true);
      }
    } catch (error) {
      console.error('Version check failed:', error);
      // Proceed anyway—don't block on errors
    } finally {
      setIsChecking(false);
    }
  };

  const handleUpdate = async () => {
    if (updateData?.url) {
      try {
        await Browser.open({ url: updateData.url });
      } catch (error) {
        console.error('Error opening browser:', error);
        // Fallback: window.open(updateData.url, '_blank');
      }
    }
    setShowModal(false);
  };

  const closeModal = () => {
    if (updateData?.force !== 1) {
      setShowModal(false);
    }
  };

  // Check version on mount (similar to ionViewDidEnter)
  useEffect(() => {
    checkVersion();
  }, []);

  const handleContinue = async () => {
    if (!childName || !gender) {
      alert("Please enter a name and select a gender.");
      return;
    }

    setIsLoading(true);
    
    try {
      const storedToken = await tokenManager.getToken();
      const storedName = localStorage.getItem("childName");
      const storedGender = localStorage.getItem("gender");

      if (storedToken && childName === storedName && gender === storedGender) {
        navigate("/home");
        return;
      }

      const response = await fetch("https://kithia.com/website_b5d91c8e/api/register-child", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ child_name: childName, child_gender: gender }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.token) {
        // Store token using the token manager
        const storedSecurely = await tokenManager.setToken(data.token);
        
        if (storedSecurely) {
          console.log("Token stored securely");
        } else {
          console.warn("Token stored in fallback storage");
        }
        
        // Store additional profile data in localStorage (non-sensitive)
        localStorage.setItem("childName", childName);
        localStorage.setItem("gender", gender);
        localStorage.setItem("verification_token", data.token);
        
        navigate("/home");
      } else {
        alert("Error registering child: " + (data.message || "Unknown error"));
      }
    } catch (error) {
      console.error("Error registering child:", error);
      alert("Error registering child: " + (error.message || "Network error"));
    } finally {
      setIsLoading(false);
    }
  };

  const containerVariants = {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: { duration: 0.5, staggerChildren: 0.2 },
    },
  };

  const topItemVariants = {
    initial: { opacity: 0, y: -50 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  const bottomItemVariants = {
    initial: { opacity: 0, y: 50 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  // Image animation variants - they will rise from below the screen
  const boyImageVariants = {
    initial: { y: "100vh", opacity: 0 }, // Start from below the screen
    animate: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 1.2,
        ease: [0.25, 0.46, 0.45, 0.94],
        delay: 0.3,
      },
    },
  };

  const girlImageVariants = {
    initial: { y: "100vh", opacity: 0 }, // Start from below the screen
    animate: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 1.2,
        ease: [0.25, 0.46, 0.45, 0.94],
        delay: 0.3, // Slightly delayed for staggered effect
      },
    },
  };

  // Modal variants
  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
  };

  const modalVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 50 },
  };

  if (isChecking) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <div className="spinner-border text-white" role="status">
          <span className="visually-hidden">Checking for updates...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <motion.div
        className="child-profile-main-container"
        variants={containerVariants}
        initial="initial"
        animate="animate"
      >
        {/* Top Icons */}
        <motion.div
          className="profile-header-icons text-white"
          variants={topItemVariants}
        >
          <img
            src={emailIcon}
            alt="Email icon"
            onClick={() => navigate("/home")}
          />

          <h4 className="text-center profile-header-text">
            Stories starring your own child
          </h4>
          <img src={musicIcon} alt="Music Icon" />
        </motion.div>

        <div className="child-profile-content">
          <div className="child-profile-container text-center mb-3">
            {/* Boy Image - rises from bottom */}
            <motion.div
              className="child-illustration-1-container"
              variants={boyImageVariants}
              initial="initial"
              animate="animate"
            >
              <img
                src={boyImage}
                alt="boy image"
                className="child-illustration-1"
              />
            </motion.div>

            {/* Center Form */}
            <motion.div variants={topItemVariants} className="child-profile-form">
              <div className="child-name-form-section mb-3">
                <label className="profile-labels">Child's name:</label>
                <input
                  type="text"
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                />
              </div>

              <div className="form-group mb-3">
                <label className="profile-labels">Gender:</label>
                <div className="gender-select-icons">
                  <div
                    className={`gender-icon ${gender === "male" ? "selected" : ""}`}
                    onClick={() => setGender("male")}
                  >
                    <img src={boyGenderIcon} alt="boy icon" />
                  </div>
                  <div
                    className={`gender-icon ${gender === "female" ? "selected" : ""}`}
                    onClick={() => setGender("female")}
                  >
                    <img src={girlGenderIcon} alt="girl icon" />
                  </div>
                </div>
              </div>
              <Card.Body>
                <Button
                  onClick={handleContinue}
                  className="continue-child-btn"
                  disabled={isLoading}
                >
                  {isLoading ? 'Loading...' : 'Continue'}
                </Button>
              </Card.Body>
            </motion.div>

            {/* Girl Image - rises from bottom */}
            <motion.div
              className="child-illustration-2-container"
              variants={girlImageVariants}
              initial="initial"
              animate="animate"
            >
              <img
                src={girlImage}
                alt="girl image"
                className="child-illustration-2"
              />
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Update Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            className="modal-backdrop"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={updateData?.force === 1 ? undefined : closeModal}
          >
            <motion.div
              className="modal-dialog modal-dialog-centered"
              role="document"
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="version-popup-content">
                <div className="popup-modal-body">
                  {updateData?.force !== 1 && (
                    <MdCancel 
                      className="custom-btn-cancel"
                      onClick={closeModal}
                    />
                  )}
                  <h5 className="version-popup-title">{updateData?.title}</h5>
                  <p className="version-popup-message">{updateData?.message}</p>
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