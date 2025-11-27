import React, { useState, useEffect, useCallback } from "react";
import { Container } from "react-bootstrap";
import { motion } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { Preferences } from '@capacitor/preferences';
import { ClipLoader } from "react-spinners";
import "./Homepage.css";
import SubscriptionModal from "../components/SubscriptionModal";
import EmailSetupModal from "../components/EmailSetupModal.js";
import ParentalGateModal from "../components/ParentalGateModal";

import backgroundMusic from "../assets/please-calm-my-mind-125566.mp3";
import emailIcon from "../assets/Email Icon.png";
import musicIcon from "../assets/Music Icon.png";
import StopMusicIcon from "../assets/Stop music icon.png";
import settingsIcon from "../assets/Settings Icon.png";
import loadingBG from "../assets/loading-background.png";
import { IoIosLock } from "react-icons/io";

// Animation Variants
const headerVariants = {
  initial: { opacity: 0, y: -100 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -100 },
};

const bookVariants = {
  initial: { opacity: 0, y: 100 },
  animate: { opacity: 1, y: 0, transition: { duration: 1 } },
  exit: { opacity: 0, y: 100 },
};

const gridVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { staggerChildren: 0.2, delay: 1 } },
  exit: { opacity: 0, transition: { duration: 0.3 } },
};

const HomePage = ({ toggleMusic, isMusicPlaying, booksData }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Use books data from props
  const books = booksData?.books || [];
  const preloadedFirstImages = booksData?.firstPages || {};
  
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [imageLoadedStatus, setImageLoadedStatus] = useState({});
  const [imagesReady, setImagesReady] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [inputDigits, setInputDigits] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [randomDigits, setRandomDigits] = useState("");

  // Animation state
  const [selectedBook, setSelectedBook] = useState(null);
  const [bookInitialPosition, setBookInitialPosition] = useState(null);
  const [firstPageImage, setFirstPageImage] = useState("");
  const [isBookOpen, setIsBookOpen] = useState(false);
  const [isExpanding, setIsExpanding] = useState(false);
  const [animationStage, setAnimationStage] = useState('initial');
  const [viewPortCenter, setViewPortCenter] = useState({ x: 0, y: 0 });
  const [clearedBooks, setClearedBooks] = useState(false);
  const [scaleFactor, setScaleFactor] = useState(1);
  const [targetX, setTargetX] = useState(0);
  const [targetY, setTargetY] = useState(0);
  const [isSelecting, setIsSelecting] = useState(false);

  // Subscription modal state
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Parental gate state
  const [showParentalGate, setShowParentalGate] = useState(false);
  const [pendingSubscription, setPendingSubscription] = useState(false);

  const imageBaseUrl = "https://kithia.com/website_b5d91c8e/book-backend/public/";

  // Calculate viewport center
  useEffect(() => {
    const updateViewportCenter = () => {
      setViewPortCenter({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2
      });
    };

    updateViewportCenter();
    window.addEventListener('resize', updateViewportCenter);

    return () => window.removeEventListener('resize', updateViewportCenter);
  }, []);

  // Load subscription status
  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      try {
        const authToken = await Preferences.get({ key: 'auth_token' });
        if (!authToken.value) {
          setIsSubscribed(false);
          await Preferences.set({ key: 'isSubscribed', value: 'false' });
          return;
        }
        const response = await fetch("https://kithia.com/website_b5d91c8e/api/user/subscription-status", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken.value}`,
            "ngrok-skip-browser-warning": "69420",
          },
          timeout: 10000,
        });
        if (!response.ok) throw new Error(`Failed to fetch subscription status: ${response.status}`);
        const data = await response.json();
        if (!data || typeof data.subscription_status !== 'string') {
          throw new Error("Invalid subscription status response");
        }
        const subscribed = data.subscription_status === "active";
        setIsSubscribed(subscribed);
        await Preferences.set({ key: 'isSubscribed', value: subscribed.toString() });
      } catch (error) {
        console.error("Error checking subscription status:", error.message);
        setIsSubscribed(false);
        await Preferences.set({ key: 'isSubscribed', value: 'false' });
      }
    };

    checkSubscriptionStatus();
  }, []);

  // Preload images and track progress
  useEffect(() => {
    if (books.length === 0) {
      setLoading(false);
      return;
    }

    let loadedCount = 0;
    const totalImages = books.length * 2; // Cover + first page for each book

    const preloadImage = (url, id) => {
      return new Promise((resolve) => {
        if (!url || url.includes('undefined')) {
          console.warn(`Invalid image URL for ID ${id}: ${url}`);
          loadedCount++;
          updateProgress();
          setImageLoadedStatus(prev => ({ ...prev, [id]: false }));
          resolve();
          return;
        }

        const img = new Image();
        
        img.onload = () => {
          loadedCount++;
          updateProgress();
          setImageLoadedStatus(prev => ({ ...prev, [id]: true }));
          resolve();
        };
        
        img.onerror = () => {
          console.error(`Failed to load image: ${url}`);
          loadedCount++;
          updateProgress();
          setImageLoadedStatus(prev => ({ ...prev, [id]: false }));
          resolve();
        };
        
        img.src = url;
      });
    };

    const updateProgress = () => {
      const newProgress = Math.min(100, Math.round((loadedCount / totalImages) * 100));
      setProgress(newProgress);
      
      if (loadedCount >= totalImages) {
        setTimeout(() => {
          setImagesReady(true);
          setLoading(false);
        }, 500);
      }
    };

    const preloadAllImages = async () => {
      try {
        setProgress(0);
        
        // Preload cover images
        const coverPromises = books.map(async (book) => {
          if (book.cover_image) {
            const url = `${imageBaseUrl}${book.cover_image}`;
            await preloadImage(url, book.id);
          } else {
            loadedCount++;
            updateProgress();
          }
        });

        await Promise.all(coverPromises);
        
        // Preload first page images
        const firstPagePromises = books.map(async (book) => {
          if (preloadedFirstImages[book.id]) {
            await preloadImage(preloadedFirstImages[book.id], `first_${book.id}`);
          } else {
            loadedCount++;
            updateProgress();
          }
        });

        await Promise.all(firstPagePromises);
        
      } catch (error) {
        console.error("Error preloading images:", error);
        setLoading(false);
      }
    };

    preloadAllImages();
  }, [books, preloadedFirstImages]);

  // Set first page image when book selected
  useEffect(() => {
    if (selectedBook && preloadedFirstImages[selectedBook.id]) {
      setFirstPageImage(preloadedFirstImages[selectedBook.id]);
    }
  }, [selectedBook, preloadedFirstImages]);

  // Calculate scale factor and target positions
  useEffect(() => {
    if (bookInitialPosition && viewPortCenter.x > 0) {
      const w = bookInitialPosition.width;
      const h = bookInitialPosition.height;
      const pageW = w - 10;
      const pageH = h - 10;
      const sX = window.innerWidth / (2 * pageW);
      const sY = window.innerHeight / pageH;
      const s = Math.max(sX, sY);
      setScaleFactor(s);

      setTargetX(viewPortCenter.x);
      setTargetY(viewPortCenter.y - h / 2);
    }
  }, [bookInitialPosition, viewPortCenter]);

  // Trigger animation stage when book is selected
  useEffect(() => {
    if (selectedBook && animationStage === 'initial') {
      setAnimationStage('opening');
      setIsBookOpen(true);
    }
  }, [selectedBook, animationStage]);

  const handleBookClick = (book, event) => {
    if (isSelecting) return;
    setIsSelecting(true);

    if (1 !== 1) {
      handleUnlockBooksClick(); 
      setIsSelecting(false);
    } else if (!book.cover_image) {
      console.warn(`No cover_image for book ID ${book.id}, skipping animation`);
      setIsSelecting(false);
    } else {
      const rect = event.currentTarget.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

      setBookInitialPosition({
        top: rect.top + scrollTop + rect.height / 2,
        left: rect.left + scrollLeft + rect.width / 2,
        width: rect.width,
        height: rect.height
      });

      setSelectedBook(book);
      setClearedBooks(true);
      setIsBookOpen(false);
      setIsExpanding(false);
      setAnimationStage('initial');
    }
  };

  const handleAnimationComplete = () => {
    if (animationStage === 'opening') {
      setAnimationStage('expanding');
      setIsExpanding(true);
    } else if (animationStage === 'expanding') {
      navigate(`/book/${selectedBook.id}/1`, {
        state: {
          fromAnimation: true,
          firstPageImage,
          book: selectedBook,
          position: bookInitialPosition
        }
      });
      setIsSelecting(false);
    }
  };

  // Parental gate handlers
  const handleUnlockBooksClick = () => {
    setPendingSubscription(true);
    setShowParentalGate(true);
  };

  const handleParentalGateSuccess = () => {
    if (pendingSubscription) {
      setShowSubscriptionModal(true);
      setPendingSubscription(false);
    }
    setShowParentalGate(false);
  };

  const handleParentalGateClose = () => {
    setShowParentalGate(false);
    setPendingSubscription(false);
  };

  const goToProfilePage = () => navigate("/profile");

  const handleModalShow = () => {
    setRandomDigits(Array.from({ length: 3 }, () => Math.floor(Math.random() * 10)).join(""));
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setInputDigits("");
    setErrorMessage("");
  };

  const handleSubscriptionModalOpen = () => setShowSubscriptionModal(true);
  const handleSubscriptionModalClose = () => setShowSubscriptionModal(false);

  const handlePaymentSuccess = () => {
    setIsSubscribed(true);
    Preferences.set({ key: 'isSubscribed', value: 'true' });
    setShowSubscriptionModal(false);
  };

  // Loading screen
  if (loading) {
    return (
      <motion.div
        variants={bookVariants}
        transition={{ duration: 0.6 }}
        style={{
          height: "100vh",
          width: "100vw",
          display: "flex",
          flexDirection: "row",
          color: "white",
          overflow: "hidden",
          backgroundImage: `linear-gradient(to right, #41dfcf11 20%, #41dfcf9a 100%), url("${loadingBG}")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "left center, left center",
          backgroundSize: "auto 100%, cover",
          alignItems: "stretch",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            padding: "20px",
            background: "transparent",
            color: "white",
          }}
        >
          <h2 style={{ margin: 0 }}>Loading stories for Sara...</h2>
          <div
            style={{
              width: "80%",
              maxWidth: 600,
              height: "8px",
              background: "rgba(255,255,255,0.08)",
              borderRadius: "4px",
              marginTop: "20px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                background: "#00ffcc",
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <Container fluid className="home-page">
      {/* Book Opening Animation Container */}
      <div
        className="book-opening-animation-container"
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 1000,
          pointerEvents: 'none',
          display: selectedBook ? 'block' : 'none',
          '--initial-width': `${bookInitialPosition?.width}px`,
          '--initial-height': `${bookInitialPosition?.height}px`,
          '--viewport-center-x': `${viewPortCenter.x}px`,
          '--viewport-center-y': `${viewPortCenter.y}px`
        }}
      >
        {selectedBook && bookInitialPosition && selectedBook.cover_image && (
          <motion.div
            className="book-wrapper"
            initial={{
              x: bookInitialPosition.left - bookInitialPosition.width / 2,
              y: bookInitialPosition.top - bookInitialPosition.height / 2,
              width: bookInitialPosition.width,
              height: bookInitialPosition.height,
            }}
            animate={
              animationStage === 'opening'
                ? {
                    x: viewPortCenter.x - bookInitialPosition.width / 2,
                    y: viewPortCenter.y - bookInitialPosition.height / 2,
                  }
                : animationStage === 'expanding'
                ? {
                    scale: scaleFactor,
                    x: targetX,
                    y: targetY,
                  }
                : {}
            }
            transition={{
              duration: animationStage === 'opening' ? 1.8 : 1,
              ease: 'easeInOut',
            }}
            style={{
              transformOrigin: animationStage === 'expanding' ? 'left 50%' : '50% 50%',
            }}
            onAnimationComplete={handleAnimationComplete}
          >
            <div className={`book-animated ${isBookOpen ? 'book-open' : ''}`}>
              <div className="book-cover-all">
                <img
                  src={imageLoadedStatus[selectedBook.id] ? `${imageBaseUrl}${selectedBook.cover_image}` : ''}
                  alt="Book Cover"
                  className="cover-image"
                />
                <div className="book-cover-back">
                  <div className="cover-back-inside"></div>
                </div>
              </div>
              <div className="page-animated blank-page-1"></div>
              <div className="page-animated blank-page-2"></div>
              <div className="page-animated blank-page-3"></div>
              <div className="page-animated blank-page-4"></div>
              <div className="first-page-left">
                <div className="page-left-front">
                  <div className="page-texture"></div>
                </div>
                <div className="page-left-back">
                  {firstPageImage && (
                    <div
                      className="page-image-left"
                      style={{ backgroundImage: `url("${firstPageImage}")` }}
                    />
                  )}
                </div>
              </div>
              <div className="first-page-right">
                {firstPageImage && (
                  <div
                    className="page-image-right"
                    style={{ backgroundImage: `url("${firstPageImage}")` }}
                  />
                )}
              </div>
              <div className="book-back-cover"></div>
            </div>
          </motion.div>
        )}
      </div>

      <motion.div
        className="sticky-header"
        variants={headerVariants}
        initial="initial"
        animate={selectedBook ? "exit" : "animate"}
        transition={{ duration: 0.6 }}
      >
        <div className="icon-container">
          <img className="home-nav-icon" src={settingsIcon} onClick={goToProfilePage} alt="Settings Icon"/>
          <img className="home-nav-icon" src={emailIcon} onClick={handleModalShow} alt="Email Icon"/>
        </div>
        <button className="unlock-btn">Little Stories For Children</button>
        <img
          className="home-nav-icon"
          onClick={toggleMusic}
          src={isMusicPlaying ? StopMusicIcon : musicIcon}
          alt="Music Icon"
        />
      </motion.div>

      <motion.div
        className="book-grid"
        initial="initial"
        variants={gridVariants}
        animate={selectedBook ? "exit" : "animate"}
        exit="exit"
        style={{ pointerEvents: selectedBook ? 'none' : 'auto' }}
      >
        {books
          .filter(book => book.cover_image)
          .map((book) => (
            <motion.div
              key={book.id}
              className="book-item"
              onClick={(e) => handleBookClick(book, e)}
              variants={bookVariants}
              transition={{ duration: 1 }}
            >
              <div className="book-container">
                <img
                  src={`${imageBaseUrl}${book.cover_image}`}
                  alt={book.title}
                  className="book-cover"
                />
                <div className="book-title-overlay">
                  <h4 className="book-title">{book.title}</h4>
                </div>
              </div>
            </motion.div>
          ))}
      </motion.div>

      <SubscriptionModal
        show={showSubscriptionModal}
        onClose={handleSubscriptionModalClose}
        onPaymentSuccess={handlePaymentSuccess}
      />
      <EmailSetupModal
        show={showModal}
        onClose={handleModalClose}
        randomDigits={randomDigits}
        setRandomDigits={setRandomDigits}
        inputDigits={inputDigits}
      />
      
      <ParentalGateModal
        show={showParentalGate}
        onClose={handleParentalGateClose}
        onSuccess={handleParentalGateSuccess}
        title="For Mom and Dad"
        instruction="Please answer this question to continue:"
      />
    </Container>
  );
};

export default HomePage;