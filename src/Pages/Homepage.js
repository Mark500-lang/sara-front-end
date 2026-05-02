import React, { useState, useEffect, useRef } from "react";
import { Container } from "react-bootstrap";
import { motion } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import "./Homepage.css";
import SubscriptionModal from "../components/SubscriptionModal";
import EmailSetupModal from "../components/EmailSetupModal.js";
import ParentalGateModal from "../components/ParentalGateModal";
import emailIcon     from "../assets/Email Icon.png";
import musicIcon     from "../assets/Music Icon.png";
import StopMusicIcon from "../assets/Stop music icon.png";
import settingsIcon  from "../assets/Settings Icon.png";
import loadingBG     from "../assets/loading-background.png";
import { IoIosLock } from "react-icons/io";
import { getSubscriptionStatus } from "../utils/subscriptionManager";

// ── Animation variants ─────────────────────────────────────────────────────────
const headerVariants = {
  initial: { opacity: 0, y: -100 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -100 },
};
const bookVariants = {
  initial: { opacity: 0, y: 100 },
  animate: { opacity: 1, y: 0, transition: { duration: 1 } },
  exit:    { opacity: 0, y: 100 },
};
const gridVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { staggerChildren: 0.2, delay: 1 } },
  exit:    { opacity: 0, transition: { duration: 0.3 } },
};

// ── Determine if a book is free (unlocked for everyone) ───────────────────────
// Only book with id === 1 is free. Everything else requires an active subscription.
const isBookFree = (book) => book.id === 1;

const HomePage = ({ toggleMusic, isMusicPlaying, booksData }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // ── Stable data refs ─────────────────────────────────────────────────────────
  // booksData?.books and booksData?.firstPages produce NEW array/object literals
  // on every render even when the underlying data is identical. Storing them in
  // refs means the image-preload useEffect dependency never sees a new reference,
  // so the effect fires exactly once — which is what eliminates the progress-bar
  // resets. The ref is only updated when booksData itself changes identity
  // (i.e. when App.js actually fetches fresh data).
  const booksRef      = useRef(booksData?.books      || []);
  const firstPagesRef = useRef(booksData?.firstPages || {});

  useEffect(() => {
    // Keep refs in sync if App.js delivers new booksData (cache → fresh fetch).
    // This does NOT re-run the preload effect — the effect reads from the refs
    // directly rather than from the dependency array.
    if (booksData?.books)      booksRef.current      = booksData.books;
    if (booksData?.firstPages) firstPagesRef.current = booksData.firstPages;
  }, [booksData]);

  // Convenience aliases used in JSX — these are just reads, not deps.
  const books                = booksRef.current;
  const preloadedFirstImages = firstPagesRef.current;

  // loading stays true until BOTH images are fetched AND subscription is known.
  // This is the single gate — nothing renders until it flips to false.
  const [loading,           setLoading]           = useState(true);
  const [progress,          setProgress]          = useState(0);
  // imageLoadedStatus stores blob: URLs (string) on success, or false on failure.
  const [imageLoadedStatus, setImageLoadedStatus] = useState({});
  const [imagesReady,       setImagesReady]       = useState(false);

  // Tracks whether each of the two parallel tasks has resolved.
  const subscriptionReadyRef = useRef(false);
  const imagesReadyRef       = useRef(false);
  // Highest progress value seen so far — ensures the bar never moves backwards.
  const progressHighWaterRef = useRef(0);

  // Modal state
  const [showModal,    setShowModal]    = useState(false);
  const [inputDigits,  setInputDigits]  = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [randomDigits, setRandomDigits] = useState("");

  // Animation state
  const [selectedBook,        setSelectedBook]        = useState(null);
  const [bookInitialPosition, setBookInitialPosition] = useState(null);
  const [firstPageImage,      setFirstPageImage]      = useState("");
  const [isBookOpen,          setIsBookOpen]          = useState(false);
  const [isExpanding,         setIsExpanding]         = useState(false);
  const [animationStage,      setAnimationStage]      = useState('initial');
  const [viewPortCenter,      setViewPortCenter]      = useState({ x: 0, y: 0 });
  const [clearedBooks,        setClearedBooks]        = useState(false);
  const [scaleFactor,         setScaleFactor]         = useState(1);
  const [targetX,             setTargetX]             = useState(0);
  const [targetY,             setTargetY]             = useState(0);
  const [isSelecting,         setIsSelecting]         = useState(false);

  // Subscription state
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [isSubscribed,          setIsSubscribed]          = useState(false);

  // Parental gate state
  const [showParentalGate,    setShowParentalGate]    = useState(false);
  const [pendingSubscription, setPendingSubscription] = useState(false);

  const imageBaseUrl = "https://kithia.com/website_b5d91c8e/book-backend/public/";

  // ── Both-ready gate ──────────────────────────────────────────────────────────
  // Stable ref version — never changes identity, so it is safe to call from
  // inside the preload effect without adding it to the dependency array.
  const maybeFinishLoadingRef = useRef(null);
  maybeFinishLoadingRef.current = () => {
    if (subscriptionReadyRef.current && imagesReadyRef.current) {
      setTimeout(() => {
        setImagesReady(true);
        setLoading(false);
      }, 400);
    }
  };

  // ── Viewport center ──────────────────────────────────────────────────────────
  useEffect(() => {
    const update = () =>
      setViewPortCenter({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // ── Subscription status check ────────────────────────────────────────────────
  // Runs in parallel with image preloading.
  // Priority: RevenueCat SDK → backend → 5-min cache → false.
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const subscribed = await getSubscriptionStatus();
      if (!cancelled) {
        setIsSubscribed(subscribed);
        subscriptionReadyRef.current = true;
        maybeFinishLoadingRef.current();
      }
    };
    check();
    return () => { cancelled = true; };
  }, []); // ← empty: subscription check runs exactly once on mount

  // ── Image preloading ─────────────────────────────────────────────────────────
  // Empty dependency array — runs exactly once on mount.
  // Data is read from booksRef / firstPagesRef (stable refs) rather than from
  // the dependency array, so re-renders in the parent never restart this effect.
  useEffect(() => {
    const books         = booksRef.current;
    const firstPages    = firstPagesRef.current;

    if (books.length === 0) {
      imagesReadyRef.current = true;
      maybeFinishLoadingRef.current();
      return;
    }

    const createdBlobUrls = [];
    let cancelled = false;

    let loadedCount = 0;
    const totalImages = books.length * 2;

    // Advance the progress bar — never backwards.
    // progressHighWaterRef ensures a re-render triggered by an unrelated state
    // change can never visually regress the bar.
    const advanceProgress = () => {
      loadedCount++;
      const raw = Math.min(100, Math.round((loadedCount / totalImages) * 100));
      const clamped = Math.max(raw, progressHighWaterRef.current);
      progressHighWaterRef.current = clamped;
      setProgress(clamped);
      if (loadedCount >= totalImages) {
        imagesReadyRef.current = true;
        maybeFinishLoadingRef.current();
      }
    };

    const preloadImage = (url, id) =>
      new Promise((resolve) => {
        if (!url || url.includes('undefined')) {
          setImageLoadedStatus(prev => ({ ...prev, [id]: false }));
          advanceProgress();
          resolve();
          return;
        }

        fetch(url, { cache: 'reload' })
          .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.blob();
          })
          .then((blob) => {
            if (cancelled) { resolve(); return; }
            const objectUrl = URL.createObjectURL(blob);
            createdBlobUrls.push(objectUrl);
            setImageLoadedStatus(prev => ({ ...prev, [id]: objectUrl }));
            advanceProgress();
            resolve();
          })
          .catch(() => {
            setImageLoadedStatus(prev => ({ ...prev, [id]: false }));
            advanceProgress();
            resolve();
          });
      });

    const preloadAllImages = async () => {
      try {
        setProgress(0);
        progressHighWaterRef.current = 0;

        await Promise.all([
          ...books.map((book) => {
            if (book.cover_image) {
              return preloadImage(`${imageBaseUrl}${book.cover_image}`, book.id);
            }
            advanceProgress();
            return Promise.resolve();
          }),
          ...books.map((book) => {
            if (firstPages[book.id]) {
              return preloadImage(firstPages[book.id], `first_${book.id}`);
            }
            advanceProgress();
            return Promise.resolve();
          }),
        ]);
      } catch (error) {
        console.error("Error preloading images:", error);
        imagesReadyRef.current = true;
        maybeFinishLoadingRef.current();
      }
    };

    preloadAllImages();

    return () => {
      cancelled = true;
      createdBlobUrls.forEach(u => URL.revokeObjectURL(u));
    };
  }, []); // ← empty: fires once on mount, reads live data from refs

  useEffect(() => {
    if (selectedBook && preloadedFirstImages[selectedBook.id]) {
      setFirstPageImage(preloadedFirstImages[selectedBook.id]);
    }
  }, [selectedBook, preloadedFirstImages]);

  useEffect(() => {
    if (bookInitialPosition && viewPortCenter.x > 0) {
      const w  = bookInitialPosition.width;
      const h  = bookInitialPosition.height;
      const sX = window.innerWidth  / (2 * (w - 10));
      const sY = window.innerHeight / (h - 10);
      setScaleFactor(Math.max(sX, sY));
      setTargetX(viewPortCenter.x);
      setTargetY(viewPortCenter.y - h / 2);
    }
  }, [bookInitialPosition, viewPortCenter]);

  useEffect(() => {
    if (selectedBook && animationStage === 'initial') {
      setAnimationStage('opening');
      setIsBookOpen(true);
    }
  }, [selectedBook, animationStage]);

  // ── Book click — subscription gate ──────────────────────────────────────────
  const handleBookClick = (book, event) => {
    if (isSelecting) return;

    // ── LOCK GATE ────────────────────────────────────────────────────────────
    // Books other than id===1 require an active subscription.
    // Tapping a locked book opens the parental gate → subscription modal.
    if (!isBookFree(book) && !isSubscribed) {
      handleUnlockBooksClick();
      return;
    }

    if (!book.cover_image) return;

    setIsSelecting(true);

    const rect       = event.currentTarget.getBoundingClientRect();
    const scrollTop  = window.pageYOffset  || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset  || document.documentElement.scrollLeft;

    setBookInitialPosition({
      top:    rect.top  + scrollTop  + rect.height / 2,
      left:   rect.left + scrollLeft + rect.width  / 2,
      width:  rect.width,
      height: rect.height,
    });

    setSelectedBook(book);
    setClearedBooks(true);
    setIsBookOpen(false);
    setIsExpanding(false);
    setAnimationStage('initial');
  };

  const handleAnimationComplete = () => {
    if (animationStage === 'opening') {
      setAnimationStage('expanding');
      setIsExpanding(true);
    } else if (animationStage === 'expanding') {
      navigate(`/book/${selectedBook.id}/1`, {
        state: { fromAnimation: true, firstPageImage, book: selectedBook, position: bookInitialPosition },
      });
      setIsSelecting(false);
    }
  };

  // ── Parental gate + subscription modal ──────────────────────────────────────
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

  const handleModalShow  = () => {
    setRandomDigits(Array.from({ length: 3 }, () => Math.floor(Math.random() * 10)).join(""));
    setShowModal(true);
  };
  const handleModalClose = () => { setShowModal(false); setInputDigits(""); setErrorMessage(""); };

  const handleSubscriptionModalClose = () => setShowSubscriptionModal(false);

  const handlePaymentSuccess = () => {
    // RC SDK + subscriptionManager cache already updated inside SubscriptionModal
    // before onPaymentSuccess fires — just mirror the state here.
    setIsSubscribed(true);
    setShowSubscriptionModal(false);
  };

  // ── Loading screen ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <motion.div
        variants={bookVariants}
        transition={{ duration: 0.6 }}
        style={{
          height: "100vh", width: "100vw",
          display: "flex", flexDirection: "row",
          color: "white", overflow: "hidden",
          backgroundImage: `linear-gradient(to right, #41dfcf11 20%, #41dfcf9a 100%), url("${loadingBG}")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "left center, left center",
          backgroundSize: "auto 100%, cover",
          alignItems: "stretch",
        }}
      >
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          justifyContent: "center", alignItems: "center",
          padding: "20px", background: "transparent", color: "white",
        }}>
          <h2 style={{ margin: 0 }}>Loading stories for Sara...</h2>
          <div style={{
            width: "80%", maxWidth: 600, height: "8px",
            background: "rgba(255,255,255,0.08)", borderRadius: "4px",
            marginTop: "20px", overflow: "hidden",
          }}>
            <div style={{
              height: "100%", width: `${progress}%`,
              background: "#00ffcc", transition: "width 0.3s ease",
            }} />
          </div>
        </div>
      </motion.div>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────────
  return (
    <Container fluid className="home-page">

      {/* Book opening animation layer */}
      <div
        className="book-opening-animation-container"
        style={{
          position: 'fixed', left: 0, top: 0,
          width: '100vw', height: '100vh',
          zIndex: 1000, pointerEvents: 'none',
          display: selectedBook ? 'block' : 'none',
          '--initial-width':     `${bookInitialPosition?.width}px`,
          '--initial-height':    `${bookInitialPosition?.height}px`,
          '--viewport-center-x': `${viewPortCenter.x}px`,
          '--viewport-center-y': `${viewPortCenter.y}px`,
        }}
      >
        {selectedBook && bookInitialPosition && selectedBook.cover_image && (
          <motion.div
            className="book-wrapper"
            initial={{
              x: bookInitialPosition.left - bookInitialPosition.width  / 2,
              y: bookInitialPosition.top  - bookInitialPosition.height / 2,
              width:  bookInitialPosition.width,
              height: bookInitialPosition.height,
            }}
            animate={
              animationStage === 'opening' ? {
                x: viewPortCenter.x - bookInitialPosition.width  / 2,
                y: viewPortCenter.y - bookInitialPosition.height / 2,
              } : animationStage === 'expanding' ? {
                scale: scaleFactor, x: targetX, y: targetY,
              } : {}
            }
            transition={{ duration: animationStage === 'opening' ? 1.8 : 1, ease: 'easeInOut' }}
            style={{ transformOrigin: animationStage === 'expanding' ? 'left 50%' : '50% 50%' }}
            onAnimationComplete={handleAnimationComplete}
          >
            <div className={`book-animated ${isBookOpen ? 'book-open' : ''}`}>
              <div className="book-cover-all">
                {/* Use the blob: URL when available; fall back to the remote URL.
                    onError handles the edge case where the blob URL was garbage-collected
                    (e.g. after a very long session) — the remote URL is always the safety net. */}
                <img
                  src={
                    imageLoadedStatus[selectedBook.id]
                      ? imageLoadedStatus[selectedBook.id]
                      : `${imageBaseUrl}${selectedBook.cover_image}`
                  }
                  alt="Book Cover"
                  className="cover-image"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = `${imageBaseUrl}${selectedBook.cover_image}`;
                  }}
                />
                <div className="book-cover-back"><div className="cover-back-inside" /></div>
              </div>
              <div className="page-animated blank-page-1" />
              <div className="page-animated blank-page-2" />
              <div className="page-animated blank-page-3" />
              <div className="page-animated blank-page-4" />
              <div className="first-page-left">
                <div className="page-left-front"><div className="page-texture" /></div>
                <div className="page-left-back">
                  {firstPageImage && (
                    <div className="page-image-left" style={{ backgroundImage: `url("${firstPageImage}")` }} />
                  )}
                </div>
              </div>
              <div className="first-page-right">
                {firstPageImage && (
                  <div className="page-image-right" style={{ backgroundImage: `url("${firstPageImage}")` }} />
                )}
              </div>
              <div className="book-back-cover" />
            </div>
          </motion.div>
        )}
      </div>

      {/* Header */}
      <motion.div
        className="sticky-header"
        variants={headerVariants}
        initial="initial"
        animate={selectedBook ? "exit" : "animate"}
        transition={{ duration: 0.6 }}
      >
        <div className="icon-container">
          <img className="home-nav-icon" src={settingsIcon} onClick={goToProfilePage} alt="Settings" />
          <img className="home-nav-icon" src={emailIcon}    onClick={handleModalShow}  alt="Email"    />
        </div>

        {!isSubscribed ? (
          <button className="unlock-btn" onClick={handleUnlockBooksClick}>
            Unlock all books
          </button>
        ) : (
          <button className="unlock-btn">Little Stories For Children</button>
        )}
        <img
          className="home-nav-icon"
          onClick={toggleMusic}
          src={isMusicPlaying ? StopMusicIcon : musicIcon}
          alt="Music"
        />
      </motion.div>

      {/* Book grid
          imagesReady is only true after BOTH cover images AND subscription status
          are fully resolved (maybeFinishLoading requires both flags).
          The grid therefore never renders with unresolved images or unknown
          lock state — no skeleton flash is possible. */}
      {imagesReady && (
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
            .map((book) => {
              const locked = !isBookFree(book) && !isSubscribed;

              return (
                <motion.div
                  key={book.id}
                  className="book-item"
                  onClick={(e) => handleBookClick(book, e)}
                  variants={bookVariants}
                  transition={{ duration: 1 }}
                >
                  <div className="book-container">
                    {/* Prefer the in-memory blob: URL created during preload.
                        If fetch failed, imageLoadedStatus[book.id] is false and
                        the src falls back to the remote URL directly.
                        onError is a final safety net if the blob URL was somehow
                        revoked or the remote URL has changed. */}
                    <img
                      src={
                        imageLoadedStatus[book.id]
                          ? imageLoadedStatus[book.id]
                          : `${imageBaseUrl}${book.cover_image}`
                      }
                      alt={book.title}
                      className="book-cover"
                      style={locked ? { filter: 'saturate(0.55)' } : undefined}
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = `${imageBaseUrl}${book.cover_image}`;
                      }}
                    />

                    {locked && (
                      <IoIosLock className="book-lock" />
                    )}

                    <div className="book-title-overlay">
                      <h4 className="book-title">{book.title}</h4>
                    </div>
                  </div>
                </motion.div>
              );
            })}
        </motion.div>
      )}

      {/* Modals */}
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