import React from "react";
// import { useNavigate } from "react-router-dom";

const PaymentSuccess = () => {
  //   const navigate = useNavigate();

  const openApp = () => {
    window.location.href = "little-stories://open/";
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "linear-gradient(to bottom, #272861, #2D3B79)",
        padding: "1rem",
      }}
    >
      <div
        style={{
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          padding: "2rem",
          borderRadius: "8px",
          textAlign: "center",
          maxWidth: "400px",
          width: "100%",
          boxShadow: "0 2px 10px rgba(0, 0, 0, 0.1)",
        }}
      >
        <h1 style={{ color: "#272861", marginBottom: "1rem" }}>
          Payment Successful!
        </h1>
        <p style={{ color: "#2D3B79", fontSize: "1.1rem" }}>
          Thank you for your purchase. Your subscription is now active.
        </p>
        <button
          style={{
            backgroundColor: "#272861",
            color: "#fff",
            padding: "0.75rem 1.5rem",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "1rem",
            marginTop: "1.5rem",
          }}
          onClick={openApp}
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default PaymentSuccess;
