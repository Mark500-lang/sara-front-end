import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";

const Signup = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    password_confirmation: "",
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
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
    setSuccess(null);
    setLoading(true);

    try {
      const response = await fetch(
        "https://kithia.com/website_b5d91c8e/api/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        }
      );

      const data = await response.json();
      setLoading(false);

      if (response.ok) {
        setSuccess(
          data.message ||
            "Signup successful! Check your email to verify your account."
        );
        // setTimeout(() => navigate("/login"), 4000);
      } else {
        setError(
          data.errors
            ? Object.values(data.errors).flat().join(" ")
            : data.message || "Something went wrong"
        );
      }
    } catch (err) {
      setLoading(false);
      setError("Network error. Please try again.");
    }
  };

  return (
    <div
      className="container d-flex justify-content-center align-items-center vh-80"
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
        <h2 className="text-center text-white mt-0">Sign Up</h2>
        {error && <div className="alert alert-danger">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label text-white">Name</label>
            <input
              type="text"
              className="form-control"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>
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
          <div className="mb-3 position-relative">
            <label className="form-label text-white">Confirm Password</label>
            <input
              type={showConfirmPassword ? "text" : "password"}
              className="form-control"
              name="password_confirmation"
              value={formData.password_confirmation}
              onChange={handleChange}
              required
            />
            <span
              className="position-absolute top-50 end-0 me-3"
              style={{ cursor: "pointer", fontSize: "20px" }}
              onClick={toggleConfirmPasswordVisibility}
            >
              {showConfirmPassword ? (
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
            {loading ? "Signing up..." : "Sign Up"}
          </button>
          {success && <div className="alert alert-success mt-2">{success}</div>}
        </form>
        <p className="text-center mt-3 text-white">
          Already have an account?{" "}
          <Link to="/login" style={{ color: "#FFD700" }}>
            Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Signup;
