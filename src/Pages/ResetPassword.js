import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";

const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const token = queryParams.get("token"); // Get token from URL

  const [formData, setFormData] = useState({
    password: "",
    password_confirmation: "",
  });

  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [showOpenApp, setShowOpenApp] = useState(false); // NEW STATE

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(
        "https://kithia.com/website_b5d91c8e/api/password/reset",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...formData, token }),
        }
      );

      const data = await response.json();
      setLoading(false);

      if (!response.ok) {
        setError(data.message || "Something went wrong.");
        return;
      }

      setMessage("Password reset successful!");
      setShowOpenApp(true); // Show "Open App" button after success
    } catch (error) {
      setLoading(false);
      setError("Failed to reset password. Try again later.");
    }
  };

  const openApp = () => {
    // Custom deep link scheme: little-stories://login
    window.location.href = "little-stories://login";
  };

  return (
    <div className="container d-flex justify-content-center align-items-center vh-100">
      <div
        className="card p-4 shadow-lg"
        style={{ width: "400px", borderRadius: "15px" }}
      >
        <h2 className="text-center">Reset Password</h2>
        {message && <div className="alert alert-success">{message}</div>}
        {error && <div className="alert alert-danger">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="mb-3 position-relative">
            <label className="form-label">New Password</label>
            <input
              type={passwordVisible ? "text" : "password"}
              className="form-control"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
            />
            <span
              className="position-absolute top-50 end-0 me-3 translate-middle-y"
              style={{ cursor: "pointer", fontSize: "20px" }}
              onClick={() => setPasswordVisible(!passwordVisible)}
            >
              {passwordVisible ? (
                <FaEyeSlash color="black" />
              ) : (
                <FaEye color="black" />
              )}
            </span>
          </div>

          <div className="mb-3 position-relative">
            <label className="form-label">Confirm Password</label>
            <input
              type={confirmPasswordVisible ? "text" : "password"}
              className="form-control"
              name="password_confirmation"
              value={formData.password_confirmation}
              onChange={handleChange}
              required
            />
            <span
              className="position-absolute top-50 end-0 me-3 translate-middle-y"
              style={{ cursor: "pointer", fontSize: "20px" }}
              onClick={() => setConfirmPasswordVisible(!confirmPasswordVisible)}
            >
              {confirmPasswordVisible ? (
                <FaEyeSlash color="black" />
              ) : (
                <FaEye color="black" />
              )}
            </span>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-100"
            disabled={loading}
          >
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </form>
        {/* Show "Open App" button AFTER success */}
        {showOpenApp && (
          <div className="mt-3 text-center">
            <button className="btn btn-success w-100" onClick={openApp}>
              Open App
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
