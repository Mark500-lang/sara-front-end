import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("Verifying...");
  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) return; // Ensure token exists before making the request

    let isMounted = true; // Prevent multiple requests

    fetch(
      `https://kithia.com/website_b5d91c8e/api/verify-email?token=${token}`,
      {
        method: "GET",
      }
    )
      .then((res) => res.json())
      .then((data) => {
        console.log("Verification response:", data);
        if (isMounted) {
          if (data.success) {
            setStatus("Your email has been verified!");
          } else {
            setStatus("Invalid or expired link.");
          }
        }
      })
      .catch((error) => {
        console.error("Fetch error:", error);
        if (isMounted) setStatus("Error verifying email.");
      });

    return () => {
      isMounted = false;
    }; // Cleanup function to prevent re-fetching
  }, [token]);

  return (
    <div
      className="text-white"
      style={{ textAlign: "center", padding: "20px" }}
    >
      <h2>{status}</h2>
      {status === "Your email has been verified!" && (
        <a
          href="little-stories://login"
          style={{
            display: "inline-block",
            padding: "10px 20px",
            backgroundColor: "#28a745",
            color: "white",
            textDecoration: "none",
            borderRadius: "5px",
            marginTop: "20px",
          }}
        >
          Open App
        </a>
      )}
    </div>
  );
};

export default VerifyEmail;
