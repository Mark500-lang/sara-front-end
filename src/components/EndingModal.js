import React from "react";
import "./EndingModal.css";
import { Modal } from "react-bootstrap";
import { motion } from "framer-motion";
import { MdCancel } from "react-icons/md"; // Import the cancel icon
import endingImage from "../assets/book-ending-image.png";
import readIcon from "../assets/screen-3/Read Icon.png";
import libraryIcon from "../assets/screen-3/Library Icon.png";

const EndingModal = ({
    show,
    onClose,
    showOverlayAgain,
    handleConfirmHomeNavigation,
}) => {
    return (
        <Modal
            show={show}
            onHide={onClose}
            fullscreen={true}
            dialogClassName="bg-transparent border-0"
            backdropClassName="custom-backdrop"
        >
            {/* Remove Modal.Header and use custom cancel button */}
            <Modal.Body className="d-flex flex-column justify-content-center align-items-center p-0">
                <motion.div
                    className="ending-modal__cover"
                    style={{
                        backgroundImage: `url("${endingImage}")`,
                    }}
                    initial={{ opacity: 0, scale: 0.98, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98, y: -20 }}
                    transition={{ duration: 0.6, ease: "easeInOut" }}
                >
                    {/* Custom cancel button */}
                    <MdCancel 
                        className="ending-cancel-btn"
                        onClick={onClose}
                    />
                    
                    <motion.h1
                        className="ending-modal__title"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15, duration: 0.4 }}
                    >
                        The End
                    </motion.h1>

                    <motion.div
                        className="custom-btn-yes"
                        onClick={showOverlayAgain}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <img src={readIcon} alt="Read Icon" />
                        <p className="ps-2">The beginning</p>
                    </motion.div>
                    <motion.div
                        className="custom-btn-yes"
                        onClick={handleConfirmHomeNavigation}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <img src={libraryIcon} alt="Library Icon" />
                        <p className="ps-2">The library</p>
                  </motion.div>
                </motion.div>
            </Modal.Body>
        </Modal>
    );
};

export default EndingModal;