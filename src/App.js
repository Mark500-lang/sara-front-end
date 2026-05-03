import React, { useEffect, useState, useRef } from "react";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  useLocation,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { App as CapacitorApp } from "@capacitor/app";
import { Preferences } from "@capacitor/preferences";
import { AnimatePresence } from "framer-motion";
import HomePage from "./Pages/Homepage";
import BookPage from "./Pages/BookPage";
import "bootstrap/dist/css/bootstrap.min.css";
import "./App.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import ChildProfileScreen from "./Pages/ChildProfileScreen";
import BookOpeningAnimation from "./components/BookOpeningAnimation";
import AdminDashboard from "./Pages/Admin/AdminDashboard";
import Signup from "./Pages/Signup";
import Login from "./Pages/Login";
import VerifyEmail from "./Pages/VerifyEmail";
import ForgotPassword from "./Pages/PasswordReset";
import ResetPassword from "./Pages/ResetPassword";
import PaymentSuccess from "./Pages/PaymentSuccess";
import backgroundMusic from "./assets/please-calm-my-mind-125566.mp3";
import DataDeletionPolicy from "./Pages/AccountDeletion";
import { getSubscriptionStatus } from "./utils/subscriptionManager";

const IMAGE_BASE_URL = "https://kithia.com/website_b5d91c8e/book-backend/public/";

// ── Image preload helper (uses browser HTTP cache) ───────────────────────────
// This is the same technique used by the reference app.
// Creating an Image with the remote URL stores it in the standard web cache.
// The cache survives WebView backgrounding on Android, so images never disappear.
const preloadImage = (url) =>
  new Promise((resolve) => {
    if (!url || url.includes("undefined")) {
      resolve();
      return;
    }
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve(); // Don't block the app if an image fails
    img.src = url;
  });

// ─────────────────────────────────────────────────────────────────────────────

function AnimatedRoutes({
  toggleMusic,
  isMusicPlaying,
  volume,
  setVolume,
  booksData,
  imagesPreloaded,
  loadingProgress,
  isSubscribed,
  onPaymentSuccess,
}) {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleAppUrlOpen = (event) => {
      if (!event.url) return;
      try {
        const url = new URL(event.url);
        const path = url.host || url.pathname.replace(/^\/+/, "");
        setTimeout(() => {
          const token = localStorage.getItem("auth_token");
          if (!path || path === "/" || path === "open") navigate("/profile");
          else if (path === "verify-email")
            navigate(`/verify-email?token=${url.searchParams.get("token")}`);
          else if (path === "reset-password")
            navigate(`/reset-password?token=${url.searchParams.get("token")}`);
          else if (path === "login") navigate("/login");
          else if (path === "admin") navigate(token ? "/admin" : "/login");
        }, 500);
      } catch (e) {
        console.error("Deep link parse error:", e);
      }
    };
    CapacitorApp.addListener("appUrlOpen", handleAppUrlOpen);
    return () => CapacitorApp.removeAllListeners("appUrlOpen");
  }, [navigate]);

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Navigate to="/profile" />} />
        <Route path="/profile" element={<ChildProfileScreen />} />
        <Route
          path="/home"
          element={
            <HomePage
              toggleMusic={toggleMusic}
              isMusicPlaying={isMusicPlaying}
              booksData={booksData}
              imagesPreloaded={imagesPreloaded}
              loadingProgress={loadingProgress}
              isSubscribed={isSubscribed}
              onPaymentSuccess={onPaymentSuccess}
              // sessionBlobCache is no longer needed – image cache is now the browser HTTP cache
            />
          }
        />
        <Route
          path="/book/:bookId/:pageId"
          element={
            <BookPage
              toggleMusic={toggleMusic}
              isMusicPlaying={isMusicPlaying}
              volume={volume}
              setVolume={setVolume}
            />
          }
        />
        <Route path="/book-animation" element={<BookOpeningAnimation />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/sign-up" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/payment-success" element={<PaymentSuccess />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/data-deletion" element={<DataDeletionPolicy />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [booksData, setBooksData] = useState(null);

  // appReady:       books metadata resolved (cache or network) → enables routing
  // imagesPreloaded: ALL images in browser cache AND subscription known → HomePage shows grid
  // loadingProgress: 0‑100 for the progress bar; owned by App so it never resets
  const [appReady, setAppReady] = useState(false);
  const [imagesPreloaded, setImagesPreloaded] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // isSubscribed – owned here; never re‑derived inside HomePage.
  const [isSubscribed, setIsSubscribed] = useState(false);

  const progressHighWaterRef = useRef(0);
  const musicRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const initializeApp = async () => {
      // ── Step 1: books metadata ──────────────────────────────────────────
      let resolvedData = null;
      try {
        const cachedData = await Preferences.get({ key: "booksData" });
        const cacheTimestamp = await Preferences.get({ key: "booksDataTimestamp" });
        const isCacheValid =
          cachedData.value &&
          cacheTimestamp.value &&
          Date.now() - parseInt(cacheTimestamp.value, 10) < 6 * 60 * 60 * 1000;

        if (isCacheValid) {
          resolvedData = JSON.parse(cachedData.value);
        } else {
          const response = await fetch(
            "https://kithia.com/website_b5d91c8e/api/books-with-first-pages",
            { headers: { "Content-Type": "application/json" } }
          );
          if (!response.ok) throw new Error(`Books fetch failed: ${response.status}`);
          const data = await response.json();
          if (!Array.isArray(data)) throw new Error("Invalid books response");

          resolvedData = {
            books: data.map((b) => ({
              id: b.id,
              title: b.title,
              cover_image: b.cover_image,
              first_page_image: b.first_page_image,
            })),
            firstPages: data.reduce((acc, b) => {
              if (b.first_page_image) acc[b.id] = `${IMAGE_BASE_URL}${b.first_page_image}`;
              return acc;
            }, {}),
          };

          if (!cancelled) {
            await Preferences.set({ key: "booksData", value: JSON.stringify(resolvedData) });
            await Preferences.set({ key: "booksDataTimestamp", value: Date.now().toString() });
          }
        }
      } catch (err) {
        console.error("[App] Books fetch error:", err);
        const fallback = await Preferences.get({ key: "booksData" });
        resolvedData = fallback.value ? JSON.parse(fallback.value) : { books: [], firstPages: {} };
      }

      if (cancelled) return;

      setBooksData(resolvedData);
      setAppReady(true);

      // ── Step 2: subscription check + image preload (parallel) ───────────
      const books = resolvedData.books || [];
      const firstPages = resolvedData.firstPages || {};

      // Subscription check (now always checks backend as primary source of truth)
      const subTask = getSubscriptionStatus().then((subscribed) => {
        if (!cancelled) setIsSubscribed(subscribed);
      });

      if (books.length === 0) {
        await subTask;
        if (!cancelled) {
          setLoadingProgress(100);
          setImagesPreloaded(true);
        }
        return;
      }

      // Build an array of preload promises for all cover & first‑page images
      const imageTasks = [];
      const totalImages = books.length * 2; // covers + first pages
      let loadedCount = 0;

      const onImageSettled = () => {
        if (cancelled) return;
        loadedCount++;
        const raw = Math.min(100, Math.round((loadedCount / totalImages) * 100));
        const clamped = Math.max(raw, progressHighWaterRef.current);
        progressHighWaterRef.current = clamped;
        setLoadingProgress(clamped);
      };

      books.forEach((book) => {
        if (book.cover_image)
          imageTasks.push(
            preloadImage(`${IMAGE_BASE_URL}${book.cover_image}`).then(onImageSettled)
          );
        if (firstPages[book.id])
          imageTasks.push(
            preloadImage(firstPages[book.id]).then(onImageSettled)
          );
      });

      // Wait for all images to be fetched/cached AND the subscription status
      await Promise.all([Promise.all(imageTasks), subTask]);

      if (!cancelled) setImagesPreloaded(true);
    };

    initializeApp();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Payment success ────────────────────────────────────────────────────
  const handlePaymentSuccess = () => setIsSubscribed(true);

  const toggleMusic = () => {
    setIsMusicPlaying((prev) => {
      if (!prev) musicRef.current?.play();
      else musicRef.current?.pause();
      return !prev;
    });
  };

  const handleVolumeChange = (newVolume) => {
    setVolume(newVolume);
    if (musicRef.current) musicRef.current.volume = newVolume;
  };

  return (
    <Router>
      <audio ref={musicRef} loop>
        <source src={backgroundMusic} type="audio/mpeg" />
      </audio>

      {!appReady ? (
        <div className="d-flex justify-content-center align-items-center vh-100">
          <div className="spinner-border text-white" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : (
        <AnimatedRoutes
          toggleMusic={toggleMusic}
          isMusicPlaying={isMusicPlaying}
          volume={volume}
          setVolume={handleVolumeChange}
          booksData={booksData}
          imagesPreloaded={imagesPreloaded}
          loadingProgress={loadingProgress}
          isSubscribed={isSubscribed}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}
    </Router>
  );
}

export default App;