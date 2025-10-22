import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import { VoiceRecorder } from "capacitor-voice-recorder";
import { Capacitor } from '@capacitor/core';
import "./BookPage.css";
import ActionIcons from "./ReadingModeSelect";
import homeIcon from "../assets/Home icon.png";
import musicIcon from "../assets/Music Icon.png";
import StopMusicIcon from "../assets/Stop music icon.png";
import readIcon from "../assets/screen-3/Read Icon.png";
import libraryIcon from "../assets/screen-3/Library Icon.png";
import { FaPause, FaPlay } from "react-icons/fa";
import { MdCancel } from "react-icons/md";
import { tokenManager } from "../utils/tokenManager";
import EndingModal from "../components/EndingModal";

const BookPage = ({ toggleMusic, isMusicPlaying, volume, setVolume }) => {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [bookPages, setBookPages] = useState([]);
  const [currentPageId, setCurrentPageId] = useState(1);
  const [currentPage, setCurrentPage] = useState(null);
  const [previousPage, setPreviousPage] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isClearedView, setIsClearedView] = useState(false);
  const [preloadedImages, setPreloadedImages] = useState({});
  const [professionalAudios, setProfessionalAudios] = useState({});
  const [myAudios, setMyAudios] = useState({});
  const [currentAudio, setCurrentAudio] = useState(null);
  const [audioPlayingUI, setAudioPlayingUI] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false); // New state for preview audio
  const [narrationVolume] = useState(1);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [selectedNarration, setSelectedNarration] = useState(null);
  const isAutoPlaying = useRef(false);
  const globalAudioRef = useRef(null);
  const globalAudioPlayingRef = useRef(false);
  const previewAudioRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBookCompleted, setIsBookCompleted] = useState(false);
  const [completeNarrators, setCompleteNarrators] = useState([]);
  const [incompleteNarrators, setIncompleteNarrators] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState("");
  const [currentBlob, setCurrentBlob] = useState(null);
  const [narratorName, setNarratorName] = useState(localStorage.getItem("narratorName") || "Me");
  const [showContinueModal, setShowContinueModal] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isPageAssetsLoaded, setIsPageAssetsLoaded] = useState(false);
  const uploadQueue = useRef([]);
  const pendingFetches = useRef(new Set());
  const isInitialRecordPage = useRef(true);
  const preloadedPages = useRef(new Set());
  const [showEndingModal, setShowEndingModal] = useState(false);

  const [readingMode, setReadingMode] = useState(() => {
    return sessionStorage.getItem(`readingMode_${bookId}`) || "read";
  });
  const [showOverlay, setShowOverlay] = useState(() => {
    const overlayDismissed = sessionStorage.getItem(`overlayDismissed_${bookId}`);
    return !overlayDismissed;
  });

  const imageBaseUrl = "https://kithia.com/website_b5d91c8e/book-backend/public/";

  useEffect(() => {
    if (readingMode) {
      sessionStorage.setItem(`readingMode_${bookId}`, readingMode);
    } else {
      sessionStorage.removeItem(`readingMode_${bookId}`);
    }
  }, [readingMode, bookId]);

  useEffect(() => {
    let timer;
    if (isRecording) {
      timer = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      setRecordingTime(0);
    }
    return () => clearInterval(timer);
  }, [isRecording]);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleScreenTap = () => {
    if (!showOverlay) {
      setIsClearedView(!isClearedView);
    }
  };

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'Escape' && isClearedView) {
        setIsClearedView(false);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isClearedView]);

  useEffect(() => {
    const fetchBookPages = async () => {
      const cachedPages = localStorage.getItem(`bookPages_${bookId}`);
      if (cachedPages) {
        setBookPages(JSON.parse(cachedPages));
        setIsLoading(false);
        return;
      }
      try {
        const response = await fetch(
          `https://kithia.com/website_b5d91c8e/api/books/${bookId}/pages`
        );
        if (!response.ok) throw new Error("Failed to fetch pages");
        const data = await response.json();
        setBookPages(data);
        localStorage.setItem(`bookPages_${bookId}`, JSON.stringify(data));
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching book pages:", error);
        setIsLoading(false);
      }
    };
    fetchBookPages();
  }, [bookId]);

  useEffect(() => {
    if (!bookPages.length) return;

    const fetchNarrators = async () => {
      const authToken = await tokenManager.getToken();
      if (!authToken) return;

      try {
        const res = await fetch(
          `https://kithia.com/website_b5d91c8e/api/audio/complete-narrators/${bookId}`,
          {
            headers: { Authorization: `Bearer ${authToken}` }
          }
        );
        if (!res.ok) throw new Error("Failed to fetch narrators");
        const data = await res.json();
        setCompleteNarrators(data.complete_narrators || []);
        setIncompleteNarrators(data.incomplete_narrators || []);
      } catch (err) {
        console.error("Error fetching narrators:", err);
      }
    };
    fetchNarrators();
  }, [bookPages, bookId]);

  const fetchAudioWithRetry = async (url, retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        const res = await fetch(url);
        if (res.ok) return await res.json();
        console.warn(`Fetch attempt ${i + 1} failed for ${url}`);
      } catch (err) {
        console.error(`Fetch error for ${url}:`, err);
      }
    }
    return null;
  };

  const fetchAudioForPage = async (pageNumber, narrator) => {
    const key = `${narrator}_${pageNumber}`;
    if (pendingFetches.current.has(key) || myAudios[narrator]?.[pageNumber]) {
      return myAudios[narrator]?.[pageNumber] || null;
    }

    pendingFetches.current.add(key);
    try {
      const authToken = await tokenManager.getToken();
      if (!authToken) return null;

      const res = await fetch(
        `https://kithia.com/website_b5d91c8e/api/audio/${bookId}/${pageNumber}?narrator=${encodeURIComponent(narrator)}`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );
      if (!res.ok) return null;

      const data = await res.json();
      const fullAudioUrl = data.audio_url ? data.audio_url.replace(
        'https://kithia.com/website_b5d91c8e/storage/',
        'https://kithia.com/website_b5d91c8e/book-backend/public/storage/'
      ) : null;

      if (fullAudioUrl) {
        const audioData = {
          url: fullAudioUrl,
          narrator,
          name: data.name || narrator,
          id: data.id
        };
        setMyAudios(prev => ({
          ...prev,
          [narrator]: {
            ...prev[narrator],
            [pageNumber]: audioData
          }
        }));
        return audioData;
      }
    } catch (err) {
      console.error(`Error fetching audio for page ${pageNumber}, narrator ${narrator}:`, err);
    } finally {
      pendingFetches.current.delete(key);
    }
    return null;
  };

  useEffect(() => {
    if (!bookPages.length) return;

    const checkPageAssetsLoaded = () => {
      const page = bookPages[currentPageId - 1];
      if (!page) return false;

      const isImageLoaded = preloadedImages[currentPageId];
      const isTextLoaded = !!page.words;
      let isAudioLoaded = true;

      if (readingMode === "listen") {
        if (selectedNarration === "professional") {
          isAudioLoaded = !!professionalAudios[currentPageId];
        } else if (selectedNarration) {
          isAudioLoaded = !!myAudios[selectedNarration]?.[currentPageId];
        } else {
          isAudioLoaded = false;
        }
      }

      return isImageLoaded && isTextLoaded && isAudioLoaded;
    };

    setIsPageAssetsLoaded(checkPageAssetsLoaded());
  }, [currentPageId, bookPages, preloadedImages, professionalAudios, myAudios, readingMode, selectedNarration]);

  useEffect(() => {
    if (!bookPages.length) return;

    const preloadRange = async (start, end) => {
      for (let i = start; i <= end && i <= bookPages.length; i++) {
        if (preloadedPages.current.has(i)) continue;

        preloadedPages.current.add(i);
        const page = bookPages[i - 1];

        if (page?.image && !preloadedImages[i]) {
          const img = new Image();
          img.src = `${imageBaseUrl}${page.image}`;
          img.onload = () => {
            setPreloadedImages(prev => ({ ...prev, [i]: img.src }));
            console.log(`Preloaded image for page ${i}`);
          };
          img.onerror = () => console.error(`Failed to preload image for page ${i}`);
        }

        if (!professionalAudios[i]) {
          try {
            const data = await fetchAudioWithRetry(`https://kithia.com/website_b5d91c8e/api/audio/universal/${bookId}/${i}`);
            if (data && data.audio_url) {
              const fullAudioUrl = data.audio_url.replace(
                'https://kithia.com/website_b5d91c8e/storage/',
                'https://kithia.com/website_b5d91c8e/book-backend/public/storage/'
              );
              setProfessionalAudios(prev => ({
                ...prev,
                [i]: { ...data, url: fullAudioUrl }
              }));
              console.log(`Preloaded professional audio for page ${i}`);
            }
          } catch (err) {
            console.error(`Error preloading pro audio for page ${i}:`, err);
          }
        }

        if (selectedNarration && selectedNarration !== "professional" && !myAudios[selectedNarration]?.[i]) {
          await fetchAudioForPage(i, selectedNarration);
        }
      }
    };

    preloadRange(currentPageId, currentPageId + 4);
  }, [currentPageId, selectedNarration, bookPages, bookId]);

  useEffect(() => {
    if (!bookPages.length) return;
    const newPage = bookPages[currentPageId - 1];
    if (newPage) {
      setPreviousPage(currentPage);
      setCurrentPage(newPage);
      setIsTransitioning(true);
      setTimeout(() => setIsTransitioning(false), 100);
    }
  }, [bookPages, currentPageId]);

  useEffect(() => {
    if (readingMode !== "listen" || !selectedNarration) {
      if (readingMode === "listen" && !selectedNarration) {
        setReadingMode("read");
        alert("Please select a narration to listen.");
      }
      return;
    }

    const handleAudioEnd = () => {
      globalAudioPlayingRef.current = false;
      setAudioPlayingUI(false);
      if (currentPageId < bookPages.length) {
        const nextPageNum = currentPageId + 1;
        isAutoPlaying.current = true;
        goToPage(nextPageNum);
      } else {
        setShowEndingModal(true);
      }
    };

    const playAudioForCurrentPage = async () => {
      setIsAudioLoading(true);
      let currentPageAudio;
      if (selectedNarration === "professional") {
        currentPageAudio = professionalAudios[currentPageId];
        if (!currentPageAudio) {
          try {
            const data = await fetchAudioWithRetry(`https://kithia.com/website_b5d91c8e/api/audio/universal/${bookId}/${currentPageId}`);
            if (data && data.audio_url) {
              const fullAudioUrl = data.audio_url.replace(
                'https://kithia.com/website_b5d91c8e/storage/',
                'https://kithia.com/website_b5d91c8e/book-backend/public/storage/'
              );
              currentPageAudio = { ...data, url: fullAudioUrl };
              setProfessionalAudios(prev => ({
                ...prev,
                [currentPageId]: currentPageAudio
              }));
            }
          } catch (err) {
            console.error("Error fetching professional audio:", err);
          }
        }
      } else {
        currentPageAudio = myAudios[selectedNarration]?.[currentPageId];
        if (!currentPageAudio) {
          currentPageAudio = await fetchAudioForPage(currentPageId, selectedNarration);
        }
      }

      if (!currentPageAudio) {
        setIsAudioLoading(false);
        setReadingMode("read");
        alert("No audio available for this page. Switching to read mode.");
        return;
      }

      if (globalAudioRef.current && globalAudioRef.current.src === currentPageAudio.url && globalAudioPlayingRef.current) {
        setIsAudioLoading(false);
        return;
      }

      if (globalAudioRef.current) {
        globalAudioRef.current.pause();
        globalAudioRef.current.removeEventListener('ended', handleAudioEnd);
        globalAudioRef.current.removeEventListener('canplaythrough', () => {});
        globalAudioRef.current = null;
      }

      try {
        const isNative = Capacitor.isNative;
        if (isNative) {
          // Hypothetical CapacitorAudio plugin for native playback
          // await CapacitorAudio.play({ url: currentPageAudio.url, volume: narrationVolume });
          // For demonstration, using Audio API with mobile considerations
          globalAudioRef.current = new Audio(currentPageAudio.url);
          globalAudioRef.current.volume = narrationVolume;
          globalAudioRef.current.addEventListener('ended', handleAudioEnd);
          globalAudioRef.current.addEventListener('canplaythrough', () => {
            setIsAudioLoading(false);
            globalAudioRef.current.play().then(() => {
              globalAudioPlayingRef.current = true;
              setAudioPlayingUI(true);
              setCurrentAudio(currentPageAudio);
            }).catch(error => {
              console.error("Audio playback failed:", error);
              globalAudioPlayingRef.current = false;
              setAudioPlayingUI(false);
              setIsAudioLoading(false);
              alert("Failed to play audio. Please try again.");
            });
          });
          globalAudioRef.current.addEventListener('error', (e) => {
            console.error("Audio error:", e);
            alert("An error occurred while playing the audio.");
          });
        } else {
          globalAudioRef.current = new Audio(currentPageAudio.url);
          globalAudioRef.current.volume = narrationVolume;
          globalAudioRef.current.addEventListener('ended', handleAudioEnd);
          globalAudioRef.current.addEventListener('canplaythrough', () => {
            setIsAudioLoading(false);
            globalAudioRef.current.play().then(() => {
              globalAudioPlayingRef.current = true;
              setAudioPlayingUI(true);
              setCurrentAudio(currentPageAudio);
            }).catch(error => {
              console.error("Audio playback failed:", error);
              globalAudioPlayingRef.current = false;
              setAudioPlayingUI(false);
              setIsAudioLoading(false);
              alert("Failed to play audio. Please try again.");
            });
          });
          globalAudioRef.current.addEventListener('error', (e) => {
            console.error("Audio error:", e);
            alert("An error occurred while playing the audio.");
          });
        }
      } catch (error) {
        console.error("Audio setup failed:", error);
        globalAudioPlayingRef.current = false;
        setAudioPlayingUI(false);
        setIsAudioLoading(false);
        alert("Failed to set up audio. Please try again.");
      }
    };

    playAudioForCurrentPage();

    return () => {
      if (globalAudioRef.current) {
        globalAudioRef.current.pause();
        globalAudioRef.current.removeEventListener('ended', handleAudioEnd);
        globalAudioRef.current.removeEventListener('canplaythrough', () => {});
        globalAudioRef.current.removeEventListener('error', () => {});
        globalAudioRef.current = null;
      }
    };
  }, [currentPageId, readingMode, selectedNarration, bookPages.length, bookId]);

  useEffect(() => {
    if (globalAudioPlayingRef.current && readingMode === "listen") {
      let currentPageAudio;
      if (selectedNarration === "professional") {
        currentPageAudio = professionalAudios[currentPageId];
      } else {
        currentPageAudio = myAudios[selectedNarration]?.[currentPageId];
      }
      if (currentPageAudio && currentPageAudio.url !== currentAudio?.url) {
        setCurrentAudio(currentPageAudio);
      } else if (!currentPageAudio) {
        setReadingMode("read");
        if (globalAudioRef.current) {
          globalAudioRef.current.pause();
          globalAudioPlayingRef.current = false;
          setAudioPlayingUI(false);
        }
        alert("No audio available for this page. Switching to read mode.");
      }
    }
  }, [currentPageId, readingMode, selectedNarration, professionalAudios, myAudios, currentAudio]);

  const requestMicrophonePermission = async () => {
    const permission = await VoiceRecorder.requestAudioRecordingPermission();
    if (!permission.value) {
      alert("Microphone permission is required to record audio.");
      return false;
    }
    return true;
  };

  const startRecording = async () => {
    const hasPermission = await requestMicrophonePermission();
    if (!hasPermission) return;
    if (isRecording) return;
    setIsRecording(true);
    setShowOverlay(false);
    sessionStorage.setItem(`overlayDismissed_${bookId}`, "true");
    setReadingMode("record");
    await VoiceRecorder.startRecording();
    isInitialRecordPage.current = false;
    console.log(`Started recording for page ${currentPageId}`);
  };

  const stopRecording = async () => {
    const result = await VoiceRecorder.stopRecording();
    setIsRecording(false);
    if (result.value && result.value.recordDataBase64) {
      const recordData = atob(result.value.recordDataBase64);
      const byteArray = new Uint8Array(recordData.length);
      for (let i = 0; i < recordData.length; i++) {
        byteArray[i] = recordData.charCodeAt(i);
      }
      const newBlob = new Blob([byteArray], { type: "audio/mp4" });
      setCurrentBlob(newBlob);
      const url = URL.createObjectURL(newBlob);
      setAudioURL(url);
      console.log(`Stopped recording for page ${currentPageId}, blob size: ${newBlob.size}`);
      return newBlob;
    }
    return null;
  };

  const deleteAudio = () => {
    if (audioURL) {
      URL.revokeObjectURL(audioURL);
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
        setIsPreviewPlaying(false);
      }
    }
    setAudioURL("");
    setCurrentBlob(null);
  };

  const uploadAudio = async (blob, page) => {
    if (!blob) {
      console.error("No audio blob to upload");
      return;
    }

    const narr = narratorName;
    const fileName = `${narr}_${page}.mp3`;
    const audioFile = new File([blob], fileName, { type: "audio/mp3" });
    const formData = new FormData();

    formData.append("audio_path", audioFile);
    formData.append("book_id", bookId);
    formData.append("page_number", page);
    formData.append("narrator", narr);

    try {
      const authToken = await tokenManager.getToken();
      if (!authToken) {
        console.error("No auth token found! User may need to register child again.");
        alert("Please set up your child profile again to upload audio.");
        return;
      }

      console.log(`Starting upload for page ${page}, book ${bookId}`);

      const response = await fetch(
        "https://kithia.com/website_b5d91c8e/api/audio/upload",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
            Accept: 'application/json'
          },
          body: formData,
        }
      );

      const result = await response.json();

      if (response.ok) {
        console.log(`Upload complete for page ${page}`);
        const audioUrlFromApi = result.audio_url;
        setMyAudios(prev => {
          const newPrev = { ...prev };
          if (!newPrev[narr]) newPrev[narr] = {};
          newPrev[narr][page] = {
            url: audioUrlFromApi,
            name: narratorName || "My Recording",
            narrator: narr,
            id: result.audio?.id,
          };
          return newPrev;
        });

        const res = await fetch(
          `https://kithia.com/website_b5d91c8e/api/audio/complete-narrators/${bookId}`,
          {
            headers: { Authorization: `Bearer ${authToken}`, Accept: 'application/json' }
          }
        );
        if (res.ok) {
          const data = await res.json();
          setCompleteNarrators(data.complete_narrators || []);
          setIncompleteNarrators(data.incomplete_narrators || []);
        }
      } else {
        if (response.status === 401) {
          await tokenManager.removeToken();
          alert("Your session has expired. Please set up your child profile again.");
        } else if (response.status === 413) {
          alert("The audio file is too large. Please try a shorter recording.");
        } else {
          alert(result.errors?.audio_path?.[0] || result.message || "Upload failed. Please try again.");
        }
      }
    } catch (error) {
      console.error("Network error uploading audio:", error);
      alert("Network error. Please check your internet connection and try again.");
    }
  };

  useEffect(() => {
    if (uploadQueue.current.length > 0) {
      const processQueue = async () => {
        const item = uploadQueue.current.shift();
        await uploadAudio(item.blob, item.page);
        if (uploadQueue.current.length > 0) {
          processQueue();
        }
      };
      processQueue();
    }
  }, [uploadQueue.current.length]);

  const playCurrent = async () => {
    if (!audioURL) return;

    if (previewAudioRef.current && !previewAudioRef.current.paused) {
      previewAudioRef.current.pause();
      setIsPreviewPlaying(false);
      return;
    }

    try {
      const isNative = Capacitor.isNative;
      if (isNative) {
        // Hypothetical CapacitorAudio plugin for native playback
        // await CapacitorAudio.play({ url: audioURL });
        // For demonstration, using Audio API
        previewAudioRef.current = new Audio(audioURL);
        previewAudioRef.current.play().then(() => {
          setIsPreviewPlaying(true);
        }).catch(error => {
          console.error("Preview audio playback failed:", error);
          setIsPreviewPlaying(false);
          alert("Failed to play preview audio. Please try again.");
        });
      } else {
        previewAudioRef.current = new Audio(audioURL);
        previewAudioRef.current.play().then(() => {
          setIsPreviewPlaying(true);
        }).catch(error => {
          console.error("Preview audio playback failed:", error);
          setIsPreviewPlaying(false);
          alert("Failed to play preview audio. Please try again.");
        });
      }
    } catch (error) {
      console.error("Preview audio setup failed:", error);
      setIsPreviewPlaying(false);
      alert("Failed to set up preview audio. Please try again.");
    }
  };

  const handleShowContinueModal = () => {
    setShowContinueModal(true);
  };

  const handleEndingModalClose = () => {
    setShowEndingModal(false);
  };

  const handleContinue = () => {
    setShowContinueModal(false);
    startRecording();
  };

  const handleStartNew = () => {
    setShowContinueModal(false);
    deleteAudio();
    startRecording();
  };

  const navigateToDraft = async (pageNum) => {
    isInitialRecordPage.current = true;
    await goToPage(pageNum);
    setShowOverlay(false);
    setReadingMode("record");
    sessionStorage.setItem(`overlayDismissed_${bookId}`, "true");
  };

  const goToPage = async (newPageId) => {
    if (newPageId < 1) return;

    if (newPageId > bookPages.length) {
      let blob = null;
      if (readingMode === "record") {
        if (isRecording) {
          blob = await stopRecording();
        }
        const uploadBlob = blob || currentBlob;
        if (!uploadBlob && !myAudios[narratorName]?.[currentPageId]) {
          alert("Please record this page before finishing.");
          return;
        }
        if (uploadBlob) {
          uploadQueue.current.push({ blob: uploadBlob, page: currentPageId });
          console.log("Uploading final page audio before finishing.");
          deleteAudio();
        }
      }
      setShowEndingModal(true);
      return;
    }

    const isNext = newPageId > currentPageId;

    if (isNext && (readingMode === "read" || readingMode === "listen")) {
      const page = bookPages[newPageId - 1];
      if (!page) return;

      const isImageLoaded = preloadedImages[newPageId];
      const isTextLoaded = !!page.words;
      let isAudioLoaded = true;

      if (readingMode === "listen") {
        if (selectedNarration === "professional") {
          isAudioLoaded = !!professionalAudios[newPageId];
        } else if (selectedNarration) {
          isAudioLoaded = !!myAudios[selectedNarration]?.[newPageId];
        } else {
          isAudioLoaded = false;
        }
      }

      if (!isImageLoaded || !isTextLoaded || !isAudioLoaded) {
        console.log(`Cannot navigate to page ${newPageId}: Image=${isImageLoaded}, Text=${isTextLoaded}, Audio=${isAudioLoaded}`);
        return;
      }
    }

    if (isNext && readingMode === "record") {
      let blob = null;
      if (isRecording) {
        blob = await stopRecording();
      }
      const uploadBlob = blob || currentBlob;
      if (!uploadBlob && !myAudios[narratorName]?.[currentPageId]) {
        alert("Please record this page first.");
        return;
      }
      if (uploadBlob) {
        uploadQueue.current.push({ blob: uploadBlob, page: currentPageId });
        deleteAudio();
      }
    }

    setIsTransitioning(true);
    setCurrentPageId(newPageId);

    if (isNext && readingMode === "record") {
      setTimeout(() => {
        startRecording();
      }, 100);
    }
  };

  const handleModeSelect = (mode) => {
    if (mode === "record") {
      isInitialRecordPage.current = true;
    }
    setReadingMode(mode);
    setShowOverlay(false);
    sessionStorage.setItem(`overlayDismissed_${bookId}`, "true");
  };

  const handlePlayNarration = async (narrator, type) => {
    if (globalAudioRef.current) {
      globalAudioRef.current.pause();
      globalAudioPlayingRef.current = false;
    }
    setSelectedNarration(type === "professional" ? "professional" : narrator);
    setReadingMode("listen");
    setShowOverlay(false);
    sessionStorage.setItem(`overlayDismissed_${bookId}`, "true");
    if (type !== "professional" && !myAudios[narrator]?.[currentPageId]) {
      await fetchAudioForPage(currentPageId, narrator);
    }
  };

  const toggleNarrationPause = () => {
    if (!globalAudioRef.current) return;
    if (globalAudioPlayingRef.current) {
      globalAudioRef.current.pause();
      globalAudioPlayingRef.current = false;
      setAudioPlayingUI(false);
    } else {
      globalAudioRef.current.play()
        .then(() => {
          globalAudioPlayingRef.current = true;
          setAudioPlayingUI(true);
        })
        .catch(error => {
          console.error("Audio play failed:", error);
          alert("Failed to play audio. Please try again.");
        });
    }
  };

  useEffect(() => {
    return () => {
      if (globalAudioRef.current) {
        globalAudioRef.current.pause();
        globalAudioRef.current.removeEventListener('ended', () => {});
        globalAudioRef.current.removeEventListener('canplaythrough', () => {});
        globalAudioRef.current.removeEventListener('error', () => {});
        globalAudioRef.current = null;
      }
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
        setIsPreviewPlaying(false);
      }
      if (audioURL) {
        URL.revokeObjectURL(audioURL);
      }
    };
  }, [bookId, audioURL]);

  const handleHomeClick = () => {
    setShowModal(true);
  };

  const handleConfirmHomeNavigation = async () => {
    if (isRecording) {
      await stopRecording();
      deleteAudio();
    } else if (currentBlob && readingMode === "record") {
      uploadQueue.current.push({ blob: currentBlob, page: currentPageId });
    }
    setShowModal(false);
    sessionStorage.removeItem(`readingMode_${bookId}`);
    sessionStorage.removeItem(`overlayDismissed_${bookId}`);
    navigate("/home");
  };

  const showOverlayAgain = async () => {
    if (globalAudioRef.current) {
      globalAudioRef.current.pause();
      globalAudioPlayingRef.current = false;
      globalAudioRef.current = null;
    }
    if (isRecording) {
      await stopRecording();
      deleteAudio();
    } else if (currentBlob && readingMode === "record") {
      uploadQueue.current.push({ blob: currentBlob, page: currentPageId });
    }
    setReadingMode(null);
    setCurrentAudio(null);
    setShowOverlay(true);
    setShowModal(false);
    setCurrentPageId(1);
    handleEndingModalClose();
    isInitialRecordPage.current = true;
  };

  const sentences = currentPage?.words?.split(/\. ?/).filter(Boolean) || [];

  const headerVariants = {
    visible: { opacity: 1, y: 0 },
    hidden: { opacity: 0, y: -50 }
  };

  const footerVariants = {
    visible: { opacity: 1, y: 0 },
    hidden: { opacity: 0, y: 50 }
  };

  const modalVariants = {
    hidden: { opacity: 0, y: -100, scale: 0.8 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94], type: "smooth", damping: 25, stiffness: 100 }
    },
    exit: { opacity: 0, y: -50, scale: 0.9, transition: { duration: 0.3, ease: "easeIn" } }
  };

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.3 } },
    exit: { opacity: 0, transition: { duration: 0.2 } }
  };

  useEffect(() => {
    if (showModal || showContinueModal) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => document.body.classList.remove('modal-open');
  }, [showModal, showContinueModal]);

  return (
    <div 
      className="book-page-container" 
      onClick={handleScreenTap}
      style={{ cursor: 'pointer' }}
    >
      <div className="book-page-background-container">
        {!isLoading && previousPage && (
          <motion.div
            key={`background-prev-${previousPage.page_number}`}
            className="book-page-background"
            style={{
              backgroundImage: `url(${
                preloadedImages[previousPage.page_number] || 
                (previousPage.image ? `${imageBaseUrl}${previousPage.image}` : "")
              })`
            }}
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
          />
        )}
        {!isLoading && currentPage && (
          <motion.div
            key={`background-current-${currentPage.page_number}`}
            className="book-page-background"
            style={{
              backgroundImage: `url(${
                preloadedImages[currentPage.page_number] || 
                (currentPage.image ? `${imageBaseUrl}${currentPage.image}` : "")
              })`
            }}
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
          />
        )}
      </div>
      <EndingModal
        show={showEndingModal}
        onClose={handleEndingModalClose}
        showOverlayAgain={showOverlayAgain}
        handleConfirmHomeNavigation={handleConfirmHomeNavigation}
      />
      {!showOverlay && (
        <motion.div
          className="header-icons"
          initial="visible"
          animate={isClearedView ? "hidden" : "visible"}
          variants={headerVariants}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="left-icon-container">
            <img
              className="book-nav-icon"
              src={homeIcon}
              onClick={handleHomeClick}
              alt="Home"
            />
            <div className="page-number">
              {currentPageId}/{bookPages.length}
            </div>
          </div>
          <div className="middle-icon-container">
            {readingMode === "read" && (
              <div className="volume-bar">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="volume-slider"
                />
              </div>
            )}
            {readingMode === "listen" && (
              <>
                <div className="pause-play-icons">
                  {audioPlayingUI ? (
                    <FaPause
                      onClick={toggleNarrationPause}
                      className="pause-play-icon"
                    />
                  ) : (
                    <FaPlay
                      onClick={toggleNarrationPause}
                      className="pause-play-icon"
                    />
                  )}
                </div>
                <div className="volume-bar">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="volume-slider"
                  />
                </div>
              </>
            )}
            {readingMode === "record" && (
              <div className="record-controls">
                {isRecording ? (
                  <button
                    className="record-button stop"
                    onClick={stopRecording}
                  >
                    ■
                  </button>
                ) : (
                  <button
                    className="record-button start"
                    onClick={() => {
                      if (audioURL) {
                        handleShowContinueModal();
                      } else {
                        startRecording();
                      }
                    }}
                  >
                    ●
                  </button>
                )}
                <span className="recording-timer">{formatTime(recordingTime)}</span>
                <button
                  className={`playback-button ${isRecording || !audioURL ? 'disabled' : ''}`}
                  onClick={playCurrent}
                  disabled={isRecording || !audioURL}
                >
                  {isPreviewPlaying ? <FaPause /> : <FaPlay />}
                </button>
              </div>
            )}
          </div>
          <div className="right-icon-container">
            <img
              className="book-nav-icon"
              onClick={toggleMusic}
              src={isMusicPlaying ? StopMusicIcon : musicIcon}
              alt="Music Icon"
            />
          </div>
        </motion.div>
      )}

      {!showOverlay && (
        <motion.div
          className="navigation-and-text-container"
          initial="visible"
          animate={isClearedView ? "hidden" : "visible"}
          variants={footerVariants}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="navigation-and-text">
            <button
              className="nav-btn left-btn"
              onClick={(e) => {
                e.stopPropagation();
                goToPage(currentPageId - 1);
              }}
            />
            <AnimatePresence mode="wait">
              <div key={`text-${currentPageId}`} className="page-text">
                {sentences.length > 0 ? (
                  sentences.map((sentence, index) => (
                    <motion.p
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.8 }}
                      key={index}
                    >
                      {sentence.trim()}.
                    </motion.p>
                  ))
                ) : (
                  <p></p>
                )}
              </div>
            </AnimatePresence>
            <button
              className="nav-btn right-btn"
              onClick={(e) => {
                e.stopPropagation();
                goToPage(currentPageId + 1);
              }}
              disabled={readingMode !== "record" && !isPageAssetsLoaded}
            />
          </div>
        </motion.div>
      )}

      {showOverlay && (
        <motion.div 
          className="action-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          onClick={(e) => e.stopPropagation()}
        >
          <ActionIcons
            bookId={bookId}
            pageNumber={currentPageId}
            overlayMode={true}
            onModeSelect={handleModeSelect}
            professionalAudio={professionalAudios[currentPageId] || null}
            myAudios={myAudios}
            completeNarrators={completeNarrators}
            incompleteNarrators={incompleteNarrators}
            totalPages={bookPages.length}
            onPlayNarration={handlePlayNarration}
            isAudioPlaying={audioPlayingUI}
            toggleMusic={toggleMusic}
            isMusicPlaying={isMusicPlaying}
            handleHomeClick={handleConfirmHomeNavigation}
            isRecording={isRecording}
            narratorName={narratorName}
            setNarratorName={setNarratorName}
            audioURL={audioURL}
            currentBlob={currentBlob}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            onDeleteAudio={deleteAudio}
            onUploadAudio={(blob) => uploadAudio(blob, currentPageId)}
            onPlayCurrent={playCurrent}
            onShowContinueModal={handleShowContinueModal}
            onNavigateToDraft={navigateToDraft}
          />
        </motion.div>
      )}

      <AnimatePresence>
        {showModal && (
          <motion.div
            className="modal-backdrop"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              className="modal-dialog modal-dialog-centered"
              role="document"
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-content custom-popup">
                <div className="popup-modal-body">
                  <MdCancel 
                    className="custom-btn-cancel"
                    onClick={() => setShowModal(false)}
                  />
                  <h5 className="custom-title">GO TO</h5>
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
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showContinueModal && (
          <motion.div
            className="modal-backdrop"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={() => setShowContinueModal(false)}
          >
            <motion.div
              className="modal-dialog modal-dialog-centered"
              role="document"
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-content custom-popup">
                <div className="popup-modal-body">
                  <MdCancel 
                    className="custom-btn-cancel"
                    onClick={() => setShowContinueModal(false)}
                  />
                  <h5 className="custom-title">You have an unsaved recording</h5>
                  <motion.div
                    className="custom-btn-yes"
                    onClick={handleContinue}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <p>Continue with the recording</p>
                  </motion.div>
                  <motion.div
                    className="custom-btn-yes"
                    onClick={handleStartNew}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <p>Start a new one</p>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BookPage;