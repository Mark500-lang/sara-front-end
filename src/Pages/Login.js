import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";

const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword((prev) => !prev);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(
        "https://kithia.com/website_b5d91c8e/api/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        }
      );

      const data = await response.json();
      setLoading(false);

      if (!response.ok) {
        if (response.status === 403) {
          setError("Your email is not verified. Please check your inbox.");
        } else {
          setError(data.message || "Login failed. Please try again.");
        }
        return;
      }

      // Store the token in localStorage
      localStorage.setItem("auth_token", data.token);

      // Redirect to home page or dashboard
      navigate("/");
    } catch (error) {
      setLoading(false);
      setError("Something went wrong. Please try again.");
    }
  };

  return (
    <div
      className="container d-flex justify-content-center align-items-center vh-100"
      style={{
        background: "linear-gradient(to bottom, #272861, #2D3B79)",
        color: "white",
      }}
    >
      <div
        className="card p-4 shadow-lg"
        style={{
          width: "400px",
          background: "#ffffff10",
          borderRadius: "15px",
        }}
      >
        <h2 className="text-center text-white">Login</h2>
        {error && <div className="alert alert-danger">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label text-white">Email</label>
            <input
              type="email"
              className="form-control"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>
          <div className="mb-3 position-relative">
            <label className="form-label text-white">Password</label>
            <input
              type={showPassword ? "text" : "password"}
              className="form-control"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
            />
            <span
              className="position-absolute top-50 end-0 me-3"
              style={{ cursor: "pointer", fontSize: "20px" }}
              onClick={togglePasswordVisibility}
            >
              {showPassword ? (
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
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
        <p className="text-center mt-3 text-white">
          Don't have an account?{" "}
          <Link to="/sign-up" style={{ color: "#FFD700" }}>
            Sign Up
          </Link>
        </p>
        <p className="text-center mt-2">
          <Link to="/forgot-password" style={{ color: "#FFD700" }}>
            Forgot Password?
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
