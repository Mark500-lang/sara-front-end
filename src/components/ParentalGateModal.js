// ParentalGateModal.js
import React, { useState, useCallback } from "react";
import { Modal, Button } from "react-bootstrap";
import { motion, AnimatePresence } from "framer-motion";

const ParentalGateModal = ({ 
  show, 
  onClose, 
  onSuccess, 
  title = "For mom and dad",
  instruction = "Please answer this question to continue:"
}) => {
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [errorMessage, setErrorMessage] = useState("");
    const [attempts, setAttempts] = useState(0);
    const [isLocked, setIsLocked] = useState(false);
    const [currentQuestion, setCurrentQuestion] = useState(getRandomQuestion());

    // Expanded Apple-approved parental gate questions (16 questions)
    function getRandomQuestion() {
        const questions = [
            {
                question: "What sound does a dog make?",
                options: ["Meow", "Woof", "Moo", "Tweet"],
                correct: 1
            },
            {
                question: "Which one is a fruit?",
                options: ["Carrot", "Broccoli", "Apple", "Potato"],
                correct: 2
            },
            {
                question: "How many hours are in a day?",
                options: ["12", "48", "24", "60"],
                correct: 2
            },
            {
                question: "What do you wear on your feet?",
                options: ["Hat", "Gloves", "Shoes", "Scarf"],
                correct: 2
            },
            {
                question: "What color is a banana?",
                options: ["Blue", "Yellow", "Red", "Green"],
                correct: 1
            },
            {
                question: "Which animal says 'meow'?",
                options: ["Dog", "Cow", "Cat", "Duck"],
                correct: 2
            },
            {
                question: "What comes after the number 5?",
                options: ["4", "6", "7", "8"],
                correct: 1
            },
            {
                question: "Which shape has three sides?",
                options: ["Circle", "Square", "Triangle", "Rectangle"],
                correct: 2
            },
            {
                question: "What do you use to write on paper?",
                options: ["Spoon", "Pencil", "Fork", "Cup"],
                correct: 1
            },
            {
                question: "Which one is a color?",
                options: ["Apple", "Red", "Car", "Book"],
                correct: 1
            },
            {
                question: "How many fingers do you have on one hand?",
                options: ["3", "4", "5", "6"],
                correct: 2
            },
            {
                question: "What do you drink when you're thirsty?",
                options: ["Food", "Water", "Toys", "Clothes"],
                correct: 1
            },
            {
                question: "Which animal has a long trunk?",
                options: ["Lion", "Elephant", "Giraffe", "Monkey"],
                correct: 1
            },
            {
                question: "What do you use to see in the dark?",
                options: ["Radio", "Flashlight", "Book", "Chair"],
                correct: 1
            },
            {
                question: "Which month comes after April?",
                options: ["March", "May", "June", "July"],
                correct: 1
            },
            {
                question: "What do you call a baby dog?",
                options: ["Kitten", "Puppy", "Calf", "Cub"],
                correct: 1
            }
        ];
        return questions[Math.floor(Math.random() * questions.length)];
    }

    const handleAnswerSelect = (answerIndex) => {
        if (isLocked) return;
        setSelectedAnswer(answerIndex);
        setErrorMessage("");
    };

    const handleClear = () => {
        setSelectedAnswer(null);
        setErrorMessage("");
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
        
        if (isLocked) {
            setErrorMessage("Too many incorrect attempts. Please try again later.");
            return;
        }

        if (selectedAnswer === null) {
            setErrorMessage("Please select an answer.");
            return;
        }

        if (selectedAnswer === currentQuestion.correct) {
            // Parental gate passed
            onSuccess();
            onClose();
        } else {
            const newAttempts = attempts + 1;
            setAttempts(newAttempts);
            setSelectedAnswer(null);
            
            if (newAttempts >= 2) {
                setIsLocked(true);
                setErrorMessage("Too many incorrect attempts. Please try again in 30 seconds.");
                setTimeout(() => {
                    setIsLocked(false);
                    setAttempts(0);
                    setCurrentQuestion(getRandomQuestion());
                    setErrorMessage("");
                }, 30000);
            } else {
                setCurrentQuestion(getRandomQuestion());
                setErrorMessage("Incorrect answer. Please try again.");
            }
        }
    };

    // Reset state when modal opens/closes
    React.useEffect(() => {
        if (show) {
            setCurrentQuestion(getRandomQuestion());
            setSelectedAnswer(null);
            setErrorMessage("");
            setAttempts(0);
            setIsLocked(false);
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
                            <Modal.Title className="modal-title">{title}</Modal.Title>
                        </Modal.Header>
                        <Modal.Body className="modal-body">
                            <p className="instruction-text">
                                {instruction}
                            </p>
                            
                            <p className="question-text">
                                {currentQuestion?.question}
                            </p>
                            
                            <div className="options-grid">
                                {currentQuestion?.options.map((option, index) => (
                                    <Button
                                        key={index}
                                        className={`option-button ${selectedAnswer === index ? 'selected' : ''}`}
                                        onClick={() => handleAnswerSelect(index)}
                                        disabled={isLocked}
                                    >
                                        {option}
                                    </Button>
                                ))}
                            </div>
                            
                            <div className="modal-actions">
                                <Button className="clear-button" onClick={handleClear} disabled={isLocked}>
                                    Clear
                                </Button>
                                {errorMessage && <p className="error-text">{errorMessage}</p>}
                                <Button 
                                    className="submit-button" 
                                    onClick={handleFormSubmit}
                                    disabled={isLocked || selectedAnswer === null}
                                >
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
                        .instruction-text {
                            font-size: 0.9rem;
                            margin-bottom: 15px;
                        }
                        .question-text {
                            font-size: 1rem;
                            font-weight: bold;
                            margin-bottom: 20px;
                            background: rgba(255, 255, 255, 0.1);
                            padding: 10px;
                            border-radius: 8px;
                        }
                        .options-grid {
                            display: grid;
                            grid-template-columns: 1fr 1fr;
                            gap: 10px;
                            margin-bottom: 20px;
                        }
                        .option-button {
                            background: linear-gradient(to bottom, #4a90e2, #357ae8);
                            color: white;
                            font-size: 0.9rem;
                            font-weight: bold;
                            border: none;
                            border-radius: 8px;
                            padding: 12px 8px;
                            min-height: 50px;
                            transition: all 0.3s ease;
                        }
                        .option-button:hover {
                            background: linear-gradient(to bottom, #357ae8, #4a90e2);
                            transform: translateY(-2px);
                        }
                        .option-button.selected {
                            background: linear-gradient(to bottom, #2ecc71, #27ae60);
                            box-shadow: 0 0 10px rgba(46, 204, 113, 0.5);
                        }
                        .option-button:disabled {
                            background: #95a5a6;
                            cursor: not-allowed;
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
                        .clear-button:disabled {
                            background: #95a5a6;
                        }
                        .submit-button {
                            background: #4caf50;
                            color: white;
                            font-weight: bold;
                            border: none;
                            border-radius: 6px;
                            padding: 8px 15px;
                        }
                        .submit-button:disabled {
                            background: #95a5a6;
                        }
                        .error-text {
                            color: #ff4d4f;
                            font-size: 0.85rem;
                            margin-top: 5px;
                            margin-bottom: 10px;
                        }
                    `}</style>
                </Modal>
            )}
        </AnimatePresence>
    );
};

export default ParentalGateModal;