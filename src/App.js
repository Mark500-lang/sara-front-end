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
import backgroundMusic from "./assets/please-calm-my-mind-125566.mp3"; // Your music file
import DataDeletionPolicy from "./Pages/AccountDeletion";

function AnimatedRoutes({ toggleMusic, isMusicPlaying, volume, setVolume }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [adminToken, setAdminToken] = useState(localStorage.getItem("auth_token"));

  const isReturningFromBook = location.state?.returningFromBook || false;

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    setAdminToken(token); // Update state when location changes
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
        <Route
          path="/"
          element={
            <Navigate to="/profile" />
          }
        />
        <Route
          path="/profile"
          element={<ChildProfileScreen />}
        />
        <Route
          path="/home"
          element={<HomePage
          isReturningFromBook={isReturningFromBook}
            toggleMusic={toggleMusic}
            isMusicPlaying={isMusicPlaying}
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
        <Route
          path="/book-animation"
          element={<BookOpeningAnimation />}
        />
        <Route
          path="/admin"
          element={<AdminDashboard />
            // adminToken ? <AdminDashboard /> : <Navigate to="/login" />
          }
        />
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
  const musicRef = useRef(null);

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
      />
    </Router>
  );
}

export default App;
