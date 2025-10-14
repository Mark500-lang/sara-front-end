import { useState, useEffect } from "react";
import { Modal, Button, Form, Spinner, Alert } from "react-bootstrap";

const SubscriptionModal = ({ show, onClose, onPaymentSuccess }) => {
  const [selectedPlan, setSelectedPlan] = useState("yearly");
  const [paymentMethod, setPaymentMethod] = useState("M-PESA");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currency, setCurrency] = useState("KES");
  const [monthlyPrice, setMonthlyPrice] = useState(700);
  const [yearlyPrice, setYearlyPrice] = useState(4200);

  useEffect(() => {
    const updatePrices = async () => {
      const country = await getUserCountry();
      if (country !== "KE") {
        setCurrency("USD");
        setMonthlyPrice(await convertPrice(700));
        setYearlyPrice(await convertPrice(4200));
      }
    };

    updatePrices();
  }, []);

  const BASE_URL = "https://kithia.com/website_b5d91c8e/api";

  useEffect(() => {
    const script = document.createElement("script");
    script.src =
      "https://unpkg.com/intasend-inlinejs-sdk@1.0.5/dist/intasend-inline.min.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handlePlanChange = (plan) => setSelectedPlan(plan);

  const handleConfirmSubscription = async () => {
    setLoading(true);
    setError(null);

    const userToken = localStorage.getItem("auth_token");

    try {
      const response = await fetch(`${BASE_URL}/subscription/initiate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          plan: selectedPlan,
          method: paymentMethod,
          phone_number: paymentMethod === "M-PESA" ? phoneNumber : undefined,
          first_name: paymentMethod === "CARD-PAYMENT" ? firstName : undefined,
          last_name: paymentMethod === "CARD-PAYMENT" ? lastName : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.payment_api_response.errors?.[0]?.detail ||
            "Payment initiation failed."
        );
      }

      if (paymentMethod === "CARD-PAYMENT") {
        const { url } = data.payment_api_response;
        window.location.href = url;
      } else if (paymentMethod === "M-PESA") {
        const { status } = data.payment_api_response;

        if (status === "PENDING") {
          alert(
            "Payment request sent to your phone. Enter your M-PESA PIN to complete the payment."
          );
          onPaymentSuccess();
        } else {
          alert("Payment initiation failed or was not successful.");
        }
      }
    } catch (err) {
      console.error("Payment Error:", err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getUserCountry = async () => {
    try {
      const response = await fetch(
        "https://ipinfo.io/json?token=60def6b50597e2"
      );
      const data = await response.json();
      return data.country;
    } catch (error) {
      console.error("Error fetching user country:", error);
      return "KE";
    }
  };
  const convertPrice = async (amountInKES) => {
    try {
      const response = await fetch(
        "https://api.exchangerate-api.com/v4/latest/KES"
      );
      const data = await response.json();
      const exchangeRate = data.rates.USD;
      return (amountInKES * exchangeRate).toFixed(2);
    } catch (error) {
      console.error("Error fetching exchange rate:", error);
      return amountInKES;
    }
  };

  return (
    <Modal show={show} onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>Subscription Plans</Modal.Title>
      </Modal.Header>
      <Modal.Body className="text-center">
        <ul className="list-unstyled text-start mb-3">
          <li>🟡 Peaceful and restful sleep for your child</li>
          <li>🔵 More than 3000 illustrations</li>
          <li>🟢 Cancel anytime</li>
        </ul>

        <Form>
          {/* Plan Selection */}
          <div
            className={`mb-2 p-3 border rounded d-flex align-items-center ${
              selectedPlan === "monthly" ? "bg-light" : ""
            }`}
            onClick={() => handlePlanChange("monthly")}
            style={{ cursor: "pointer" }}
          >
            <Form.Check
              type="radio"
              id="monthly"
              name="plan"
              checked={selectedPlan === "monthly"}
              onChange={() => handlePlanChange("monthly")}
              className="me-2"
            />
            <span>
              {currency} {monthlyPrice} per month
            </span>
          </div>

          <div
            className={`mb-2 p-3 border rounded d-flex align-items-center ${
              selectedPlan === "yearly" ? "bg-light" : ""
            }`}
            onClick={() => handlePlanChange("yearly")}
            style={{ cursor: "pointer" }}
          >
            <Form.Check
              type="radio"
              id="yearly"
              name="plan"
              checked={selectedPlan === "yearly"}
              onChange={() => handlePlanChange("yearly")}
              className="me-2"
            />
            <div>
              <span>
                {currency} {yearlyPrice} per year
              </span>
            </div>
          </div>

          {/* Payment Method Dropdown */}
          <Form.Group className="mb-3">
            <Form.Label>Payment Method</Form.Label>
            <Form.Select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="M-PESA">M-PESA</option>
              <option value="CARD-PAYMENT">Card (Visa/Mastercard)</option>
            </Form.Select>
          </Form.Group>

          {/* Conditionally Render Fields Based on Payment Method */}
          {paymentMethod === "CARD-PAYMENT" && (
            <>
              <Form.Group className="mb-3">
                <Form.Label>First Name</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Enter first name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Last Name</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Enter last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </Form.Group>
            </>
          )}

          {paymentMethod === "M-PESA" && (
            <Form.Group className="mb-3">
              <Form.Label>Phone Number (e.g., 254712345678)</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter phone number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
              />
            </Form.Group>
          )}
        </Form>

        {error && <Alert variant="danger">{error}</Alert>}

        <Button
          variant="warning"
          className="mt-3 w-100 fw-bold"
          onClick={handleConfirmSubscription}
          disabled={loading}
        >
          {loading ? <Spinner animation="border" size="sm" /> : "Subscribe Now"}
        </Button>
      </Modal.Body>
      <Modal.Footer className="d-flex justify-content-between">
        <a
          href="https://www.privacypolicies.com/live/396845b8-e470-4bed-8cbb-5432ab867986"
          className="text-decoration-none"
        >
          Privacy Policy
        </a>
      </Modal.Footer>
    </Modal>
  );
};

export default SubscriptionModal;
