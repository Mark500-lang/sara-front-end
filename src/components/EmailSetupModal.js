import React, { useState } from "react";
import { Modal, Button } from "react-bootstrap";
import { motion, AnimatePresence } from "framer-motion";

// Animation Variants (optional, can be customized)
const EmailSetupModal = ({ show, onClose }) => {
    const [inputDigits, setInputDigits] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [randomDigits, setRandomDigits] = useState(generateRandomDigits());

    // Generate three random digits as a string
    function generateRandomDigits() {
        return Array.from({ length: 3 }, () =>
            Math.floor(Math.random() * 10)
        ).join("");
    }

    const numberToWords = (num) => {
        const words = [
            "zero",
            "one",
            "two",
            "three",
            "four",
            "five",
            "six",
            "seven",
            "eight",
            "nine",
        ];
        return num
            .split("")
            .map((digit) => words[parseInt(digit)])
            .join(", ");
    };

    const handleInputChange = (digit) => {
        if (inputDigits.length < 3) {
            setInputDigits((prevDigits) => prevDigits + digit);
        }
    };

    const handleClear = () => {
        setInputDigits("");
        setErrorMessage("");
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
        if (inputDigits === randomDigits) {
            window.location.href = `mailto:support@papricut.com?subject=Support Request`;
        } else {
            setErrorMessage("The digits entered are incorrect. Please try again.");
        }
    };

    // Reset state when modal opens/closes
    React.useEffect(() => {
        if (show) {
            setRandomDigits(generateRandomDigits());
            setInputDigits("");
            setErrorMessage("");
        }
    }, [show]);

    return (
        <AnimatePresence>
            {show && (
                <Modal
                    show={show}
                    onHide={onClose}
                    centered
                    dialogClassName="custom-modal"
                >
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0, transition: { duration: 0.4 } }}
                        exit={{ opacity: 0, y: 50, transition: { duration: 0.3 } }}
                    >
                        <Modal.Header closeButton>
                            <Modal.Title className="modal-title">For Dad and Mom</Modal.Title>
                        </Modal.Header>
                        <Modal.Body className="modal-body">
                            <p className="input-label">
                                Input digits: {numberToWords(randomDigits)}
                            </p>
                            <div className="digit-display">{inputDigits}</div>
                            <div className="calculator">
                                {Array.from({ length: 10 }, (_, i) => (
                                    <Button
                                        key={i}
                                        className="calculator-button"
                                        onClick={() => handleInputChange(i.toString())}
                                    >
                                        {i}
                                    </Button>
                                ))}
                            </div>
                            <div className="modal-actions">
                                <Button className="clear-button" onClick={handleClear}>
                                    Clear
                                </Button>
                                {errorMessage && <p className="error-text">{errorMessage}</p>}
                                <Button className="submit-button" onClick={handleFormSubmit}>
                                    Submit
                                </Button>
                            </div>
                        </Modal.Body>
                    </motion.div>
                    <style jsx>{`
                        .custom-modal .modal-dialog {
                            max-width: 400px;
                            height: 100vh;
                            display: flex;
                            align-items: center;
                        }
                        .custom-modal .modal-content {
                            border-radius: 15px;
                            background: linear-gradient(to bottom, #272861, #2d3b79);
                            color: white;
                            padding: 15px;
                            border: none;
                            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
                            height: 100vh;
                            display: flex;
                            flex-direction: column;
                            justify-content: center;
                        }
                        .modal-title {
                            font-size: 1.2rem;
                            font-weight: bold;
                            text-align: center;
                            color: white;
                        }
                        .modal-body {
                            top: -40px;
                            text-align: center;
                            flex: 1;
                        }
                        .input-label {
                            font-size: 0.9rem;
                            margin-bottom: 10px;
                        }
                        .digit-display {
                            font-size: 1rem;
                            background: white;
                            color: black;
                            padding: 8px;
                            border-radius: 6px;
                            margin-bottom: 10px;
                            display: inline-block;
                            min-width: 120px;
                        }
                        .calculator {
                            display: grid;
                            grid-template-columns: repeat(3, 1fr);
                            gap: 8px;
                            margin-bottom: 15px;
                            justify-items: center;
                        }
                        .calculator-button {
                            width: 35px;
                            height: 35px;
                            border-radius: 50%;
                            background: linear-gradient(to bottom, #4a90e2, #357ae8);
                            color: white;
                            font-size: 1rem;
                            font-weight: bold;
                            border: none;
                            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
                        }
                        .calculator-button:hover {
                            background: linear-gradient(to bottom, #357ae8, #4a90e2);
                        }
                        .clear-button {
                            background: #f44336;
                            color: white;
                            font-weight: bold;
                            border: none;
                            border-radius: 6px;
                            padding: 8px 15px;
                            margin-right: 8px;
                        }
                        .submit-button {
                            background: #4caf50;
                            color: white;
                            font-weight: bold;
                            border: none;
                            border-radius: 6px;
                            padding: 8px 15px;
                        }
                        .error-text {
                            color: #ff4d4f;
                            font-size: 0.85rem;
                            margin-top: 5px;
                        }
                    `}</style>
                </Modal>
            )}
        </AnimatePresence>
    );
};

export default EmailSetupModal;
