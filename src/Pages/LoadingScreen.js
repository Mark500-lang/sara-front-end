import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
// import bunnyImage from "../assets/bunny.png"; 

function LoadingScreen({ onComplete }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => onComplete(), 500); // small delay before transition
          return 100;
        }
        return prev + 2;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <motion.div
      className="loading-screen d-flex flex-column align-items-center justify-content-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        // backgroundColor: "#0B0D3A",
        height: "100vh",
        width: "100vw",
        color: "white",
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 9999,
      }}
    >
      <h2 style={{ color: "#FFD43B", fontWeight: "bold" }}>
        We are preparing our stories for you
      </h2>
      <p>Personalizing images and texts...</p>
      <div
        style={{
          width: "80%",
          height: "6px",
          backgroundColor: "white",
          borderRadius: "5px",
          overflow: "hidden",
          marginBottom: "20px",
        }}
      >
        <motion.div
          style={{
            height: "100%",
            // backgroundColor: "#22223B",
            borderRadius: "5px",
          }}
          animate={{ width: `${progress}%` }}
          transition={{ ease: "linear" }}
        />
      </div>
      {/* <img
        src={bunnyImage}
        alt="Bunny"
        style={{ maxWidth: "200px", marginTop: "20px" }}
      /> */}
    </motion.div>
  );
}

export default LoadingScreen;