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
import { Preferences } from '@capacitor/preferences';
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

function AnimatedRoutes({ 
  toggleMusic, 
  isMusicPlaying, 
  volume, 
  setVolume, 
  booksData 
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [adminToken, setAdminToken] = useState(localStorage.getItem("auth_token"));

  const isReturningFromBook = location.state?.returningFromBook || false;

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    setAdminToken(token);
  }, [location.pathname]);

  useEffect(() => {
    const handleAppUrlOpen = (event) => {
      if (event.url) {
        try {
          const url = new URL(event.url);
          let path = url.host || url.pathname.replace(/^\/+/, "");

          setTimeout(() => {
            const token = localStorage.getItem("auth_token");
            if (!path || path === "/" || path === "open") {
              navigate("/profile");
            } else if (path === "verify-email") {
              navigate(`/verify-email?token=${url.searchParams.get("token")}`);
            } else if (path === "reset-password") {
              navigate(
                `/reset-password?token=${url.searchParams.get("token")}`
              );
            } else if (path === "login") {
              navigate("/login");
            } else if (path === "admin") {
              if (!token) {
                navigate("/login");
              } else {
                navigate("/admin");
              }
            }
          }, 500);
        } catch (error) {
          console.error("Error parsing deep link URL:", error);
        }
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
              isReturningFromBook={isReturningFromBook}
              toggleMusic={toggleMusic}
              isMusicPlaying={isMusicPlaying}
              booksData={booksData}
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
  const musicRef = useRef(null);

  // Fetch all book data once on app initialization
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Check for cached data first
        const cachedData = await Preferences.get({ key: 'booksData' });
        const cacheTimestamp = await Preferences.get({ key: 'booksDataTimestamp' });
        
        const isCacheValid = cachedData.value && cacheTimestamp.value && 
          (Date.now() - parseInt(cacheTimestamp.value)) < (24 * 60 * 60 * 1000); // 24 hour cache
        
        if (isCacheValid) {
          console.log("Loading books from cache");
          setBooksData(JSON.parse(cachedData.value));
          return;
        }

        // Fetch fresh data from API
        const response = await fetch("https://kithia.com/website_b5d91c8e/api/books-with-first-pages", {
          method: "GET",
          headers: {
            "ngrok-skip-browser-warning": "69420",
            "Content-Type": "application/json",
          },
          timeout: 15000,
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch books: ${response.status}`);
        }

        const data = await response.json();
        
        if (!Array.isArray(data)) {
          throw new Error("Invalid books response: not an array");
        }

        console.log("Fetched books with first pages:", data);
        
        // Transform data for easier access
        const transformedData = {
          books: data.map(book => ({
            id: book.id,
            title: book.title,
            cover_image: book.cover_image,
            first_page_image: book.first_page_image
          })),
          firstPages: data.reduce((acc, book) => {
            if (book.first_page_image) {
              acc[book.id] = `https://kithia.com/website_b5d91c8e/book-backend/public/${book.first_page_image}`;
            }
            return acc;
          }, {})
        };

        setBooksData(transformedData);
        
        // Cache the data
        await Preferences.set({ 
          key: 'booksData', 
          value: JSON.stringify(transformedData) 
        });
        await Preferences.set({ 
          key: 'booksDataTimestamp', 
          value: Date.now().toString() 
        });
        
      } catch (error) {
        console.error("Error initializing app:", error);
        
        // Try to use cached data even if expired
        const cachedData = await Preferences.get({ key: 'booksData' });
        if (cachedData.value) {
          console.log("Using expired cache as fallback");
          setBooksData(JSON.parse(cachedData.value));
        } else {
          // No data available
          setBooksData({ books: [], firstPages: {} });
        }
      }
    };

    initializeApp();
  }, []);

  const toggleMusic = () => {
    setIsMusicPlaying(!isMusicPlaying);
    if (!isMusicPlaying) {
      musicRef.current.play();
    } else {
      musicRef.current.pause();
    }
  };

  const handleVolumeChange = (newVolume) => {
    setVolume(newVolume);
    if (musicRef.current) {
      musicRef.current.volume = newVolume;
    }
  };

  return (
    <Router>
      <audio ref={musicRef} loop>
        <source src={backgroundMusic} type="audio/mpeg" />
        Your browser does not support the audio tag.
      </audio>
      <AnimatedRoutes
        toggleMusic={toggleMusic}
        isMusicPlaying={isMusicPlaying}
        volume={volume}
        setVolume={handleVolumeChange}
        booksData={booksData}
      />
    </Router>
  );
}

export default App;