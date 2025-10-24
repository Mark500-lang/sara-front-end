import React, { useState, useEffect } from "react";
import { Container } from "react-bootstrap";
import { motion } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { Preferences } from '@capacitor/preferences';
import { ClipLoader } from "react-spinners";
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
  animate: { opacity: 1, y: 0, transition: { duration: 1 } },
  exit: { opacity: 0, y: 100 },
};

const gridVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { staggerChildren: 0.2, delay: 1 } },
  exit: { opacity: 0, transition: { duration: 0.3 } },
};

const HomePage = ({ toggleMusic, isMusicPlaying }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [books, setBooks] = useState([]);
  const [preloadedFirstImages, setPreloadedFirstImages] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingSubscription, setLoadingSubscription] = useState(true);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [loadingPreloads, setLoadingPreloads] = useState(true);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [imageLoadedStatus, setImageLoadedStatus] = useState({});

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

  // Load book data and subscription status
  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      try {
        const authToken = await Preferences.get({ key: 'auth_token' });
        if (!authToken.value) {
          setIsSubscribed(false);
          await Preferences.set({ key: 'isSubscribed', value: 'false' });
          setLoadingSubscription(false);
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
      } finally {
        setLoadingSubscription(false);
      }
    };

    const fetchBooks = async () => {
      const fromRegistration = location.state?.fromRegistration;
      const cachedBooks = await Preferences.get({ key: 'books' });
      const cachedFirstImages = await Preferences.get({ key: 'firstPages' });
      const appLoaded = await Preferences.get({ key: 'appLoaded' });

      // Check cache synchronously to skip loading screen
      if (!fromRegistration && cachedBooks.value && appLoaded.value === 'true') {
        try {
          const parsedBooks = JSON.parse(cachedBooks.value);
          console.log("Loaded cached books:", parsedBooks);
          setBooks(parsedBooks);
          setPreloadedFirstImages(cachedFirstImages.value ? JSON.parse(cachedFirstImages.value) : {});
          setLoadingBooks(false);
          setLoadingPreloads(false);
          setLoading(false); // Skip loading screen
          return;
        } catch (error) {
          console.error("Error parsing cached books:", error.message);
        }
      }

      // Fetch books if no cache or from registration
      try {
        const response = await fetch("https://kithia.com/website_b5d91c8e/api/books", {
          method: "GET",
          headers: {
            "ngrok-skip-browser-warning": "69420",
            "Content-Type": "application/json",
          },
          timeout: 10000,
        });
        if (!response.ok) throw new Error(`Failed to fetch books: ${response.status}`);
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error("Invalid books response: not an array");
        console.log("Fetched books from API:", data);
        setBooks(data);
        await Preferences.set({ key: 'books', value: JSON.stringify(data) });
        await Preferences.set({ key: 'appLoaded', value: 'true' });
      } catch (err) {
        console.error("Error fetching books:", err.message);
        setError(err.message);
        setBooks([]);
      } finally {
        setLoadingBooks(false);
      }
    };

    checkSubscriptionStatus();
    fetchBooks();
  }, [location.state]);

  // Preload cover and first page images
  useEffect(() => {
    const preloadImage = (url, id) => {
      return new Promise((resolve, reject) => {
        if (!url || url.includes('undefined')) {
          console.warn(`Invalid image URL for ID ${id}: ${url}`);
          setImageLoadedStatus(prev => ({ ...prev, [id]: false }));
          resolve();
          return;
        }
        const img = new Image();
        img.src = url;
        img.onload = () => {
          setImageLoadedStatus(prev => ({ ...prev, [id]: true }));
          resolve();
        };
        img.onerror = () => {
          console.error(`Failed to preload image: ${url}`);
          setImageLoadedStatus(prev => ({ ...prev, [id]: false }));
          resolve();
        };
      });
    };

    const preloadResources = async () => {
      if (loadingBooks || books.length === 0) return;

      try {
        // Preload all cover images concurrently
        await Promise.all(
          books.map(async (book) => {
            if (!book.cover_image) {
              console.warn(`No cover_image for book ID ${book.id}:`, book);
              setImageLoadedStatus(prev => ({ ...prev, [book.id]: false }));
              return;
            }
            const url = `${imageBaseUrl}${book.cover_image}`;
            await preloadImage(url, book.id);
          })
        );

        // Preload existing first page images concurrently
        await Promise.all(
          Object.values(preloadedFirstImages).map(async (url) => {
            await preloadImage(url, `first_${Object.keys(preloadedFirstImages).find(key => preloadedFirstImages[key] === url)}`);
          })
        );

        // Fetch and preload missing first page images sequentially
        let newFirstImages = { ...preloadedFirstImages };
        const missingBooks = books.filter((book) => !preloadedFirstImages[book.id]);

        for (const book of missingBooks) {
          try {
            const response = await fetch(`https://kithia.com/website_b5d91c8e/api/books/${book.id}/pages`, {
              headers: { "ngrok-skip-browser-warning": "69420" },
              timeout: 5000,
            });
            if (!response.ok) {
              console.warn(`Failed to fetch pages for book ${book.id}: ${response.status}`);
              continue;
            }
            const pages = await response.json();
            console.log(`Pages for book ${book.id}:`, pages);
            if (pages.length > 0 && pages[0].image) {
              const imageUrl = `${imageBaseUrl}${pages[0].image}`;
              await preloadImage(imageUrl, `first_${book.id}`);
              newFirstImages[book.id] = imageUrl;
            } else {
              console.warn(`No first page image for book ID ${book.id}: Empty response or missing image`);
            }
          } catch (err) {
            console.error(`Error preloading first page for book ${book.id}:`, err.message);
          }
        }

        if (Object.keys(newFirstImages).length > Object.keys(preloadedFirstImages).length) {
          setPreloadedFirstImages(newFirstImages);
          await Preferences.set({ key: 'firstPages', value: JSON.stringify(newFirstImages) });
        }
      } catch (err) {
        console.error("Error in preloadResources:", err.message);
      } finally {
        setLoadingPreloads(false);
      }
    };

    preloadResources();
  }, [loadingBooks, books, preloadedFirstImages]);

  // Handle loading progress
  useEffect(() => {
    const fromRegistration = location.state?.fromRegistration;

    const checkAppLoaded = async () => {
      const { value: appLoaded } = await Preferences.get({ key: 'appLoaded' });
      const { value: cachedBooksValue } = await Preferences.get({ key: 'books' });

      console.log('CheckAppLoaded:', { appLoaded, cachedBooks: !!cachedBooksValue, loadingSubscription, loadingBooks, loadingPreloads });

      if (!fromRegistration && appLoaded === 'true' && cachedBooksValue && books.length > 0) {
        // Skip loading screen if cache exists and books are loaded
        setLoading(false);
      } else if (loadingSubscription || loadingBooks || loadingPreloads) {
        // Animate progress bar while loading
        const totalDuration = 3000; // 3 seconds for smooth animation
        const increment = 100 / (totalDuration / 200); // Increment every 200ms
        let currentProgress = 0;

        const timer = setInterval(() => {
          currentProgress = Math.min(currentProgress + increment, 90); // Cap at 90% until loading completes
          setProgress(currentProgress);
        }, 200);

        return () => clearInterval(timer);
      } else {
        // Complete progress animation to 100% before showing homepage
        setProgress(100);
        const timer = setTimeout(() => {
          setLoading(false);
          Preferences.set({ key: 'appLoaded', value: 'true' });
        }, 1000); // Wait for final 100% animation (1s)

        return () => clearTimeout(timer);
      }
    };

    checkAppLoaded();
  }, [loadingSubscription, loadingBooks, loadingPreloads, books, location.state]);

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

      // Position the wrapper's left edge (spine/origin) at horizontal center
      setTargetX(viewPortCenter.x);

      // Keep vertical positioning centered (top at centerY - h/2, scales around vertical center)
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

    if (book.id !== 1 && !isSubscribed) {
      handleSubscriptionModalOpen();
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
    Preferences.set({ key: 'isSubscribed', value: 'true' });
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
                transition: "width 1s ease", // Match animation duration
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

  return (
    <Container fluid className="home-page">
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
        {!isSubscribed ? (
          <button className="unlock-btn" onClick={handleSubscriptionModalOpen}>
            Unlock all books
          </button>
        ) : (
          <button className="unlock-btn">Little Stories For Children</button>
        )}
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
                {imageLoadedStatus[book.id] ? (
                  <img
                    src={`${imageBaseUrl}${book.cover_image}`}
                    alt={book.title}
                    className="book-cover"
                  />
                ) : (
                  <div className="book-cover-loading">
                    <ClipLoader color="#00ffcc" size={30} />
                  </div>
                )}
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
    </Container>
  );
};

export default HomePage;