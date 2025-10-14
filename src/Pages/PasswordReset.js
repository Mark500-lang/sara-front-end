import { useState } from "react";
import { Link } from "react-router-dom";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(
        "https://kithia.com/website_b5d91c8e/api/password/request-reset",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        }
      );

      const data = await response.json();
      setLoading(false);

      if (!response.ok) {
        setError(data.message || "Something went wrong.");
        return;
      }

      setMessage("Password reset link sent! Check your email.");
    } catch (error) {
      setLoading(false);
      setError("Failed to send request. Try again later.");
    }
  };

  return (
    <div className="container d-flex justify-content-center align-items-center vh-100">
      <div
        className="card p-4 shadow-lg"
        style={{ width: "400px", borderRadius: "15px" }}
      >
        <h2 className="text-center">Forgot Password?</h2>
        {message && <div className="alert alert-success">{message}</div>}
        {error && <div className="alert alert-danger">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label">Enter your email</label>
            <input
              type="email"
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary w-100"
            disabled={loading}
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>
        <p className="text-center mt-3">
          <Link to="/login" style={{ color: "#FFD700" }}>
            Back to Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;
