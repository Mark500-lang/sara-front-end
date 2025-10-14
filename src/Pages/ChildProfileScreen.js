import React, { useState, useEffect } from "react";
import { Card, Button, Form, Row, Col } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { SecureStorage } from '@aparajita/capacitor-secure-storage';

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

  // Load profile data from localStorage
  useEffect(() => {
    const storedName = localStorage.getItem("childName");
    const storedGender = localStorage.getItem("gender");

    if (storedName) setChildName(storedName);
    if (storedGender) setGender(storedGender);
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

  return (
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
              ></input>
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
              >
                Continue
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
  );
};

export default ChildProfileScreen;