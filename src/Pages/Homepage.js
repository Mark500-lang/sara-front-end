import React, { useState, useEffect, useRef } from "react";
import { Container } from "react-bootstrap";
import { motion } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import "./Homepage.css";
import SubscriptionModal from "../components/SubscriptionModal";
import EmailSetupModal from "../components/EmailSetupModal.js";

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
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 100 },
};

const gridVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { staggerChildren: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.3 } },
};

const HomePage = ({ toggleMusic, isMusicPlaying }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [books, setBooks] = useState(() => {
    const cached = localStorage.getItem('books');
    return cached ? JSON.parse(cached) : [];
  });
  const [preloadedFirstImages, setPreloadedFirstImages] = useState(() => {
    const cached = localStorage.getItem('firstPages');
    return cached ? JSON.parse(cached) : {};
  });
  const [loading, setLoading] = useState(true);
  const [loadingSubscription, setLoadingSubscription] = useState(true);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [loadingPreloads, setLoadingPreloads] = useState(true);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

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
  const [isSubscribed, setIsSubscribed] = useState(() => localStorage.getItem('isSubscribed') === 'true');

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

  // Combined effect for subscription and books
  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      try {
        const response = await fetch("https://kithia.com/website_b5d91c8e/api/user/subscription-status", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          },
        });
        if (!response.ok) throw new Error("Failed to fetch subscription status");
        const data = await response.json();
        const subscribed = data.subscription_status === "active";
        setIsSubscribed(subscribed);
        localStorage.setItem('isSubscribed', subscribed);
      } catch (error) {
        console.error("Error checking subscription status:", error);
      } finally {
        setLoadingSubscription(false);
      }
    };

    checkSubscriptionStatus();

    if (localStorage.getItem('books')) {
      setLoadingBooks(false);
    } else {
      const fetchBooks = async () => {
        try {
          const response = await fetch("https://kithia.com/website_b5d91c8e/api/books", {
            method: "GET",
            headers: {
              "ngrok-skip-browser-warning": "69420",
              "Content-Type": "application/json",
            },
          });
          if (!response.ok) throw new Error("Failed to fetch books");
          const data = await response.json();
          setBooks(data);
          localStorage.setItem('books', JSON.stringify(data));
        } catch (err) {
          setError(err.message);
        } finally {
          setLoadingBooks(false);
        }
      };

      fetchBooks();
    }
  }, []);

  // Preload covers and first page images
  useEffect(() => {
    const preloadImage = (url) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });
    };

    const preloadResources = async () => {
      if (loadingBooks || books.length === 0) return;

      try {
        // Preload all cover images concurrently
        await Promise.all(
          books.map((book) =>
            preloadImage(`https://kithia.com/website_b5d91c8e/book-backend/public/${book.cover_image}`)
          )
        );

        // Preload existing first page images concurrently
        await Promise.all(
          Object.values(preloadedFirstImages).map(preloadImage)
        );

        // Fetch and preload missing first page images sequentially
        const missingBooks = books.filter((book) => !preloadedFirstImages[book.id]);
        let newFirstImages = {};

        for (const book of missingBooks) {
          try {
            const response = await fetch(`https://kithia.com/website_b5d91c8e/api/books/${book.id}/pages`);
            if (!response.ok) throw new Error(`Failed to fetch pages for book ${book.id}`);
            const pages = await response.json();
            if (pages.length > 0) {
              const imageUrl = `https://kithia.com/website_b5d91c8e/book-backend/public/${pages[0].image}`;
              await preloadImage(imageUrl);
              newFirstImages[book.id] = imageUrl;
            }
          } catch (err) {
            console.error(`Error preloading first page for book ${book.id}:`, err);
          }
        }

        if (Object.keys(newFirstImages).length > 0) {
          const updatedFirstImages = { ...preloadedFirstImages, ...newFirstImages };
          setPreloadedFirstImages(updatedFirstImages);
          localStorage.setItem('firstPages', JSON.stringify(updatedFirstImages));
        }
      } catch (err) {
        console.error("Error in preloadResources:", err);
      } finally {
        setLoadingPreloads(false);
      }
    };

    preloadResources();
  }, [loadingBooks, books]);

  // Handle loading progress
  useEffect(() => {
    let timer;
    if (loadingSubscription || loadingBooks || loadingPreloads) {
      timer = setInterval(() => {
        setProgress((prev) => Math.min(prev + Math.random() * 10, 90));
      }, 200);
    } else {
      setProgress(100);
      setTimeout(() => {
        setLoading(false);
        if (!localStorage.getItem('appLoaded')) {
          localStorage.setItem('appLoaded', 'true');
        }
      }, 500);
    }
    return () => clearInterval(timer);
  }, [loadingSubscription, loadingBooks, loadingPreloads]);

  // Set first page image from preloaded when book selected
  useEffect(() => {
    if (selectedBook && preloadedFirstImages[selectedBook.id]) {
      setFirstPageImage(preloadedFirstImages[selectedBook.id]);
    }
  }, [selectedBook, preloadedFirstImages]);

  // Calculate scale factor and target positions
  useEffect(() => {
    if (bookInitialPosition) {
      const w = bookInitialPosition.width;
      const h = bookInitialPosition.height;
      const pageW = w - 10;
      const pageH = h - 10;
      const topOffset = 5;
      const sX = window.innerWidth / (2 * pageW);
      const sY = window.innerHeight / pageH;
      const s = Math.max(sX, sY);
      setScaleFactor(s);

      const isOverflowVert = s > sY;
      const topTarget = isOverflowVert ? 0 : (window.innerHeight - pageH * s) / 2;
      const targetYCalc = topTarget + (h / 2) * (s - 1) - topOffset * s;
      setTargetY(targetYCalc);

      const leftTarget = 0;
      const targetXCalc = leftTarget + pageW * s;
      setTargetX(targetXCalc);
    }
  }, [bookInitialPosition]);

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

    if (book.id !== 1 && !isSubscribed) {
      handleSubscriptionModalOpen();
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
    }
  };

  const goToProfilePage = () => {
    navigate("/profile");
  };

  const handleModalShow = () => {
    generateRandomDigits();
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setInputDigits("");
    setErrorMessage("");
  };

  const generateRandomDigits = () => {
    const digits = Array.from({ length: 3 }, () =>
      Math.floor(Math.random() * 10)
    ).join("");
    setRandomDigits(digits);
  };

  const handleSubscriptionModalOpen = () => {
    setShowSubscriptionModal(true);
  };

  const handleSubscriptionModalClose = () => {
    setShowSubscriptionModal(false);
  };

  const handlePaymentSuccess = () => {
    setIsSubscribed(true);
    setShowSubscriptionModal(false);
  };

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
        backgroundImage: `linear-gradient(to right, rgba(0, 0, 0, 0.2) 20%, rgba(0, 0, 0, 1) 100%), url("${loadingBG}")`,
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
        <h2 style={{ margin: 0 }}>Loading your bedtime stories...</h2>
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

  if (error) {
    return <div>{error}</div>;
  }

  const imageBaseUrl = "https://kithia.com/website_b5d91c8e/book-backend/public/";

  return (
    <Container fluid className="home-page">   
      {/* Book Opening Animation - Integrated directly */}
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
        {selectedBook && bookInitialPosition && (
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
              duration: 
                animationStage === 'opening' ? 1.8 
                : 1,
              ease: 'easeInOut',
            }}
            style={{
              transformOrigin: animationStage === 'expanding' ? 'left 50%' : '50% 50%',
            }}
            onAnimationComplete={handleAnimationComplete}
          >
            <div className={`book-animated ${isBookOpen ? 'book-open' : ''}`}>
              {/* Book Cover */}
              <div className="book-cover-all">
                <img
                  src={`${imageBaseUrl}${selectedBook.cover_image}`}
                  alt="Book Cover"
                  className="cover-image"
                />
                <div className="book-cover-back">
                  <div className="cover-back-inside"></div>
                </div>
              </div>

              {/* Blank pages */}
              <div className="page-animated blank-page-1"></div>
              <div className="page-animated blank-page-2"></div>
              <div className="page-animated blank-page-3"></div>
              <div className="page-animated blank-page-4"></div>

              {/* First page spread */}
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

              {/* First page - right side */}
              <div className="first-page-right">
                {firstPageImage && (
                  <div 
                    className="page-image-right"
                    style={{ backgroundImage: `url("${firstPageImage}")` }}
                  />
                )}
              </div>

              {/* Back cover */}
              <div className="book-back-cover"></div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Sticky Header */}
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

        {!isSubscribed ? (
          <button className="unlock-btn" onClick={handleSubscriptionModalOpen}>
            Unlock all books
          </button>
        ) : (
          <button className="unlock-btn">Little Stories For Children</button>
        )}

        <SubscriptionModal
          show={showSubscriptionModal}
          onClose={handleSubscriptionModalClose}
          onPaymentSuccess={handlePaymentSuccess}
        />

        <img 
          className="home-nav-icon" 
          onClick={toggleMusic} 
          src={isMusicPlaying ? StopMusicIcon : musicIcon}
          alt="Music Icon"
        />
      </motion.div>

      {/* Book Grid */}
      <motion.div
        className="book-grid"
        initial="initial"
        variants={gridVariants}
        animate={selectedBook ? "exit" : "animate"}
        exit="exit"
        style={{ pointerEvents: selectedBook ? 'none' : 'auto' }}
      >
        {books.map((book) => (
          <motion.div
            key={book.id}
            className="book-item"
            onClick={(e) => handleBookClick(book, e)}
            variants={bookVariants}
            transition={{ duration: 0.6 }}
            animate={selectedBook ? { opacity: 0, scale: 0 } : { opacity: 1, scale: 1 }}
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

              {book.id !== 1 && !isSubscribed && (
                <IoIosLock className="book-lock"/>
              )}
            </div>
          </motion.div>
        ))}
      </motion.div>

      <EmailSetupModal
        show={showModal}
        onClose={handleModalClose}
        randomDigits={randomDigits}
        setRandomDigits={setRandomDigits}
        inputDigits={inputDigits} 
      />
    </Container>
  );
};

export default HomePage;