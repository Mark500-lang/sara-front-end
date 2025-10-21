import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./ReadingModeSelect.css";
import listenIcon from "../assets/screen-3/Listen Icon.png";
import readIcon from "../assets/screen-3/Read Icon.png";
import recordIcon from "../assets/screen-3/Record Icon.png";
import homeIcon from "../assets/Home icon.png";
import musicIcon from "../assets/Music Icon.png";
import StopMusicIcon from "../assets/Stop music icon.png";

const ActionIcons = ({
  bookId,
  pageNumber,
  onModeSelect,
  overlayMode = false,
  professionalAudio,
  myAudios,
  completeNarrators,
  incompleteNarrators,
  totalPages,
  onPlayNarration,
  isAudioPlaying,
  toggleMusic,
  isMusicPlaying,
  handleHomeClick,
  isRecording,
  narratorName,
  setNarratorName,
  audioURL,
  currentBlob,
  onStartRecording,
  onStopRecording,
  onDeleteAudio,
  onUploadAudio,
  onPlayCurrent,
  onShowContinueModal,
  onNavigateToDraft,
}) => {
  const [selectedMode, setSelectedMode] = useState(null);

  const headerVariants = {
    hidden: { opacity: 0, y: -50 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
  };

  const modeButtonsVariants = {
    hidden: { opacity: 0, x: -50 },
    visible: { 
      opacity: 1, 
      x: 0, 
      transition: { duration: 0.5, ease: "easeOut" } 
    },
    withDialogue: {
      opacity: 1,
      x: -60,
      transition: { 
        duration: 0.7, 
        ease: [0.25, 0.46, 0.45, 0.94],
        delay: 0.1
      }
    }
  };

  const dialogueVariants = {
    hidden: { 
      opacity: 0, 
      x: 150, 
      scale: 1
    },
    visible: { 
      opacity: 1, 
      x: 30, 
      scale: 1, 
      transition: { 
        duration: 0.7, 
        ease: [0.25, 0.46, 0.45, 0.94],
        when: "beforeChildren",
        staggerChildren: 0.1
      } 
    },
    exit: { 
      opacity: 0, 
      x: 150,
      scale: 0.95,
      transition: { duration: 0.5, ease: "easeIn" } 
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7 } }
  };

  const handleIconClick = (icon) => {
    setSelectedMode(icon);
    if (icon === "read" && onModeSelect) {
      onModeSelect(icon);
    }
  };

  const handleRecordButtonClick = () => {
    if (audioURL) {
      onShowContinueModal();
    } else {
      onStartRecording();
    }
  };

  const handleSetNarratorName = (e) => {
    setNarratorName(e.target.value);
    localStorage.setItem("narratorName", e.target.value);
  };

  return (
    <div className={`action-icons ${overlayMode ? "overlay-style" : ""}`}>
      <motion.div 
        className="action-header-container"
        initial="hidden"
        animate="visible"
        variants={headerVariants}
      >
        <div className="home-action-container">
          <img
            src={homeIcon}
            alt="Home Icon"
            onClick={handleHomeClick}
          />
        </div>  
        <div className="mucic-action-container">
          <img
            className="book-nav-icon"
            onClick={toggleMusic}
            src={isMusicPlaying ? StopMusicIcon : musicIcon}
            alt="Music Icon"
          />
        </div>
      </motion.div>

      <motion.div
        className="select-mode-container"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div 
          className="action-icons-container"
          variants={modeButtonsVariants}
          animate={selectedMode ? "withDialogue" : "visible"}
        >
          <motion.div
            className={`mode-button ${selectedMode === "read" ? "clicked-mode-btn" : ""}`}
            onClick={() => handleIconClick("read")}
            whileHover={{ scale: 1.05, transition: { duration: 0.2 } }}
            whileTap={{ scale: 0.95 }}
          >
            <img src={readIcon} alt="Read Icon" />
            <p className="ps-2">Read</p>
          </motion.div>

          <motion.div
            className={`mode-button ${selectedMode === "listen" ? "clicked-mode-btn" : ""}`}
            onClick={() => handleIconClick("listen")}
            whileHover={{ scale: 1.05, transition: { duration: 0.2 } }}
            whileTap={{ scale: 0.95 }}
          >
            <img src={listenIcon} alt="Listen Icon" />
            <p className="ps-2">Listen</p>
          </motion.div>

          <motion.div
            className={`mode-button ${selectedMode === "record" ? "clicked-mode-btn" : ""}`}
            onClick={() => handleIconClick("record")}
            whileHover={{ scale: 1.05, transition: { duration: 0.2 } }}
            whileTap={{ scale: 0.95 }}
          >
            <img src={recordIcon} alt="Record Icon" />
            <p>Record</p>
          </motion.div>
        </motion.div>

        <AnimatePresence mode="wait">
          {selectedMode && (
            <motion.div
              className="select-mode-dialogue-box"
              variants={dialogueVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              key={selectedMode}
            >
              {selectedMode === "listen" && (
                <>
                  <motion.div className="proffesional-voice-over" variants={itemVariants}>
                    <h3>Generated Voice-over</h3>
                    {professionalAudio ? (
                      <motion.div className="audio-item" variants={itemVariants}>
                        <span>{professionalAudio.narrator}: {professionalAudio.name}</span>
                        <button 
                          onClick={() => onPlayNarration("professional", "professional")}
                          className={`play-button`}
                        >
                          Play
                        </button>
                      </motion.div>
                    ) : (
                      <motion.p variants={itemVariants}>No generated audio available</motion.p>
                    )}
                  </motion.div>
                  <motion.div className="my-voice-over" variants={itemVariants}>
                    <h3>My Voice-over</h3>
                    {completeNarrators.length > 0 ? (
                      completeNarrators.map(narrator => (
                        <motion.div className="audio-item" key={narrator} variants={itemVariants}>
                          <span>{narrator}</span>
                          <button 
                            onClick={() => onPlayNarration(narrator, "my")}
                            className={`play-button`}
                          >
                            Play
                          </button>
                        </motion.div>
                      ))
                    ) : (
                      <motion.p variants={itemVariants}>No complete recordings yet</motion.p>
                    )}
                  </motion.div>
                </>
              )}

              {selectedMode === "record" && (
                <>
                  <motion.div className="recordings-box" variants={itemVariants}>
                    <h3>New Recording</h3>
                    <input
                      type="text"
                      value={narratorName}
                      onChange={handleSetNarratorName}
                      placeholder="File name:"
                    />
                    {isRecording ? (
                      <button
                        className="record-button active"
                        onClick={onStopRecording}
                      >
                        Stop
                      </button>
                    ) : (
                      <button
                        className={`record-button ${narratorName.trim() ? "active" : ""}`}
                        disabled={!narratorName.trim()}
                        onClick={handleRecordButtonClick}
                      >
                        {"Start"}
                      </button>
                    )}
                  </motion.div>
                  <motion.div className="my-voice-over" variants={itemVariants}>
                    <h3>Files</h3>
                    {incompleteNarrators.length > 0 ? (
                      incompleteNarrators.map(({ narrator, page_count }) => (
                        <motion.div className="audio-item" key={narrator} variants={itemVariants}>
                          <span 
                            className="draft-name" 
                            onClick={() => {
                              localStorage.setItem("narratorName", narrator);
                              setNarratorName(narrator);
                              let firstUnrecorded = 1;
                              for (let i = 1; i <= totalPages; i++) {
                                if (!myAudios[narrator]?.[i]) {
                                  console.log("First unrecorded page:", i);
                                  firstUnrecorded = i;
                                  break;
                                }
                              }
                              onNavigateToDraft(page_count + 1);
                            }}
                            style={{ cursor: 'pointer', textDecoration: 'underline' }}
                          >
                            Draft: <span className="boldened-text">{narrator}</span> ({page_count}/{totalPages} pages)
                          </span>
                        </motion.div>
                      ))
                    ) : (
                      <motion.p variants={itemVariants}>Empty</motion.p>
                    )}
                  </motion.div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default ActionIcons;