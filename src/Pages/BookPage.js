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
import readIconWhite from "../assets/screen-3/Read Icon - white.png";
import libraryIconWhite from "../assets/screen-3/Library Icon - white.png";
import { FaPause, FaPlay } from "react-icons/fa";
import { MdCancel } from "react-icons/md";
import { tokenManager } from "../utils/tokenManager";
import { initDeviceIdentity } from "../utils/deviceIdentity";
import EndingModal from "../components/EndingModal";

const BookPage = ({ toggleMusic, isMusicPlaying, volume, setVolume }) => {
  const { bookId } = useParams();
  const navigate   = useNavigate();

  const [showModal,           setShowModal]           = useState(false);
  const [bookPages,           setBookPages]           = useState([]);
  const [currentPageId,       setCurrentPageId]       = useState(1);
  const [currentPage,         setCurrentPage]         = useState(null);
  const [previousPage,        setPreviousPage]        = useState(null);
  const [isTransitioning,     setIsTransitioning]     = useState(false);
  const [isClearedView,       setIsClearedView]       = useState(false);
  const [preloadedImages,     setPreloadedImages]     = useState({});
  const [professionalAudios,  setProfessionalAudios]  = useState({});
  const [myAudios,            setMyAudios]            = useState({});
  const [currentAudio,        setCurrentAudio]        = useState(null);
  const [audioPlayingUI,      setAudioPlayingUI]      = useState(false);
  const [isPreviewPlaying,    setIsPreviewPlaying]    = useState(false);
  const [narrationVolume]                             = useState(1);
  const [isAudioLoading,      setIsAudioLoading]      = useState(false);
  const [selectedNarration,   setSelectedNarration]   = useState(null);
  const [isLoading,           setIsLoading]           = useState(true);
  const [completeNarrators,   setCompleteNarrators]   = useState([]);
  const [incompleteNarrators, setIncompleteNarrators] = useState([]);
  const [isRecording,         setIsRecording]         = useState(false);
  const [audioURL,            setAudioURL]            = useState("");
  const [currentBlob,         setCurrentBlob]         = useState(null);
  const [narratorName,        setNarratorName]        = useState(
    localStorage.getItem("narratorName") || "Me"
  );
  const [showContinueModal,   setShowContinueModal]   = useState(false);
  const [recordingTime,       setRecordingTime]       = useState(0);
  const [isPageAssetsLoaded,  setIsPageAssetsLoaded]  = useState(false);
  const [showEndingModal,     setShowEndingModal]     = useState(false);
  const [isAuthReady,         setIsAuthReady]         = useState(false);

  const isAutoPlaying         = useRef(false);
  const globalAudioRef        = useRef(null);
  const globalAudioPlayingRef = useRef(false);
  const previewAudioRef       = useRef(null);
  const uploadQueue           = useRef([]);
  const pendingFetches        = useRef(new Set());
  const isInitialRecordPage   = useRef(true);
  const preloadedPages        = useRef(new Set());
  // Tracks whether we're in auto-advance so we don't double-trigger
  const isAdvancingPage       = useRef(false);

  const imageBaseUrl = "https://kithia.com/website_b5d91c8e/book-backend/public/";

  const [readingMode, setReadingMode] = useState(
    () => sessionStorage.getItem(`readingMode_${bookId}`) || "read"
  );
  const [showOverlay, setShowOverlay] = useState(
    () => !sessionStorage.getItem(`overlayDismissed_${bookId}`)
  );

  useEffect(() => {
    if (readingMode) sessionStorage.setItem(`readingMode_${bookId}`, readingMode);
    else             sessionStorage.removeItem(`readingMode_${bookId}`);
  }, [readingMode, bookId]);

  // ── Auth bootstrap ──────────────────────────────────────────────────────────
  useEffect(() => {
    const bootstrap = async () => {
      try {
        await initDeviceIdentity(tokenManager);
      } catch (err) {
        console.error('[BookPage] Auth bootstrap:', err.message);
      } finally {
        setIsAuthReady(true);
      }
    };
    bootstrap();
  }, []);

  // ── Recording timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    let timer;
    if (isRecording) timer = setInterval(() => setRecordingTime(p => p + 1), 1000);
    else             setRecordingTime(0);
    return () => clearInterval(timer);
  }, [isRecording]);

  const formatTime = (s) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const handleScreenTap = () => {
    if (!showOverlay) setIsClearedView(p => !p);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && isClearedView) setIsClearedView(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isClearedView]);

  // ── Fetch book pages ────────────────────────────────────────────────────────
  useEffect(() => {
    const fetch_ = async () => {
      const cached = localStorage.getItem(`bookPages_${bookId}`);
      if (cached) { setBookPages(JSON.parse(cached)); setIsLoading(false); return; }
      try {
        const res  = await fetch(`https://kithia.com/website_b5d91c8e/api/books/${bookId}/pages`);
        if (!res.ok) throw new Error('Failed to fetch pages');
        const data = await res.json();
        setBookPages(data);
        localStorage.setItem(`bookPages_${bookId}`, JSON.stringify(data));
      } catch (err) {
        console.error('[BookPage] fetchBookPages:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetch_();
  }, [bookId]);

  // ── Fetch narrators ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!bookPages.length || !isAuthReady) return;
    const fetchNarrators = async () => {
      const token = await tokenManager.getToken();
      if (!token) return;
      try {
        const res  = await fetch(
          `https://kithia.com/website_b5d91c8e/api/audio/complete-narrators/${bookId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) throw new Error(`fetchNarrators: ${res.status}`);
        const data = await res.json();
        setCompleteNarrators(data.complete_narrators   || []);
        setIncompleteNarrators(data.incomplete_narrators || []);
      } catch (err) {
        console.error('[BookPage] fetchNarrators:', err);
      }
    };
    fetchNarrators();
  }, [bookPages, bookId, isAuthReady]);

  // ── Audio helpers ───────────────────────────────────────────────────────────
  const fetchAudioWithRetry = async (url, retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        const res = await fetch(url);
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn(`[BookPage] retry ${i + 1}:`, err.message);
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
      const token = await tokenManager.getToken();
      if (!token) return null;
      const res = await fetch(
        `https://kithia.com/website_b5d91c8e/api/audio/${bookId}/${pageNumber}?narrator=${encodeURIComponent(narrator)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) return null;
      const data = await res.json();
      const url  = data.audio_url?.replace(
        'https://kithia.com/website_b5d91c8e/storage/',
        'https://kithia.com/website_b5d91c8e/book-backend/public/storage/'
      ) || null;
      if (url) {
        const audioData = { url, narrator, name: data.name || narrator, id: data.id };
        setMyAudios(prev => ({
          ...prev,
          [narrator]: { ...prev[narrator], [pageNumber]: audioData }
        }));
        return audioData;
      }
    } catch (err) {
      console.error(`[BookPage] fetchAudioForPage p${pageNumber}:`, err);
    } finally {
      pendingFetches.current.delete(key);
    }
    return null;
  };

  useEffect(() => {
    if (!bookPages.length || completeNarrators.length === 0 || !isAuthReady) return;
    const preload = async () => {
      for (const narrator of completeNarrators) {
        for (let i = 1; i <= Math.min(6, bookPages.length); i++) {
          if (!myAudios[narrator]?.[i]) await fetchAudioForPage(i, narrator);
        }
      }
    };
    preload();
  }, [completeNarrators, bookPages.length, isAuthReady]);

  // ── Page asset check ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!bookPages.length) return;
    const page = bookPages[currentPageId - 1];
    if (!page) return;
    const imgOk = !!preloadedImages[currentPageId];
    const txtOk = !!page.words;
    let audOk   = true;
    if (readingMode === "listen" && selectedNarration) {
      if      (selectedNarration === "professional") audOk = !!professionalAudios[currentPageId];
      else                                          audOk = !!myAudios[selectedNarration]?.[currentPageId];
    }
    setIsPageAssetsLoaded(imgOk && txtOk && audOk);
  }, [currentPageId, bookPages, preloadedImages, professionalAudios, myAudios, readingMode, selectedNarration]);

  // ── Preload images + audio ──────────────────────────────────────────────────
  useEffect(() => {
    if (!bookPages.length) return;
    const preloadRange = async (start, end) => {
      for (let i = start; i <= end && i <= bookPages.length; i++) {
        if (preloadedPages.current.has(i)) continue;
        preloadedPages.current.add(i);
        const page = bookPages[i - 1];
        if (page?.image && !preloadedImages[i]) {
          const img  = new Image();
          img.src    = `${imageBaseUrl}${page.image}`;
          img.onload = () => setPreloadedImages(prev => ({ ...prev, [i]: img.src }));
        }
        if (!professionalAudios[i]) {
          const data = await fetchAudioWithRetry(
            `https://kithia.com/website_b5d91c8e/api/audio/universal/${bookId}/${i}`
          );
          if (data?.audio_url) {
            const url = data.audio_url.replace(
              'https://kithia.com/website_b5d91c8e/storage/',
              'https://kithia.com/website_b5d91c8e/book-backend/public/storage/'
            );
            setProfessionalAudios(prev => ({ ...prev, [i]: { ...data, url } }));
          }
        }
        if (selectedNarration && selectedNarration !== "professional" && !myAudios[selectedNarration]?.[i]) {
          await fetchAudioForPage(i, selectedNarration);
        }
      }
    };
    preloadRange(Math.max(1, currentPageId - 1), Math.min(bookPages.length, currentPageId + 5));
  }, [currentPageId, selectedNarration, bookPages, bookId]);

  // ── Current page sync ───────────────────────────────────────────────────────
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

  // ── AUTO-PLAYBACK: listen mode audio ───────────────────────────────────────
  // FIX 1: Only fires when selectedNarration is already set (no premature alert).
  // FIX 2: Uses a timeout fallback in case canplaythrough never fires (mobile).
  // FIX 3: Auto-advances to next page when audio ends.
  useEffect(() => {
    if (readingMode !== "listen" || !selectedNarration) return;

    let isCancelled = false;

    const stopCurrentAudio = () => {
      if (globalAudioRef.current) {
        globalAudioRef.current.pause();
        globalAudioRef.current.onended   = null;
        globalAudioRef.current.onerror   = null;
        globalAudioRef.current.oncanplaythrough = null;
        globalAudioRef.current = null;
      }
      globalAudioPlayingRef.current = false;
      setAudioPlayingUI(false);
    };

    const handleAudioEnd = () => {
      if (isCancelled || isAdvancingPage.current) return;
      globalAudioPlayingRef.current = false;
      setAudioPlayingUI(false);

      // Auto-advance to next page
      const nextPage = currentPageId + 1;
      if (nextPage <= bookPages.length) {
        isAdvancingPage.current = true;
        // Small delay so the page transition animation doesn't clash with audio
        setTimeout(() => {
          isAdvancingPage.current = false;
          setCurrentPageId(nextPage);
        }, 300);
      } else {
        setShowEndingModal(true);
      }
    };

    const playAudio = async () => {
      setIsAudioLoading(true);

      // Fetch audio for current page
      let pageAudio;
      if (selectedNarration === "professional") {
        pageAudio = professionalAudios[currentPageId];
        if (!pageAudio) {
          const data = await fetchAudioWithRetry(
            `https://kithia.com/website_b5d91c8e/api/audio/universal/${bookId}/${currentPageId}`
          );
          if (data?.audio_url) {
            const url = data.audio_url.replace(
              'https://kithia.com/website_b5d91c8e/storage/',
              'https://kithia.com/website_b5d91c8e/book-backend/public/storage/'
            );
            pageAudio = { ...data, url };
            setProfessionalAudios(prev => ({ ...prev, [currentPageId]: pageAudio }));
          }
        }
      } else {
        pageAudio = myAudios[selectedNarration]?.[currentPageId]
                 || await fetchAudioForPage(currentPageId, selectedNarration);
      }

      if (!pageAudio || isCancelled) {
        setIsAudioLoading(false);
        // No audio for this page — advance automatically rather than stalling
        if (!isCancelled) {
          const nextPage = currentPageId + 1;
          if (nextPage <= bookPages.length) {
            setTimeout(() => setCurrentPageId(nextPage), 500);
          } else {
            setShowEndingModal(true);
          }
        }
        return;
      }

      // Don't restart if the same audio is already playing
      if (globalAudioRef.current?.src === pageAudio.url && globalAudioPlayingRef.current) {
        setIsAudioLoading(false);
        return;
      }

      stopCurrentAudio();
      if (isCancelled) return;

      const audio = new Audio(pageAudio.url);
      audio.volume = narrationVolume;
      globalAudioRef.current = audio;

      const attemptPlay = () => {
        if (isCancelled) return;
        audio.play()
          .then(() => {
            if (isCancelled) { audio.pause(); return; }
            globalAudioPlayingRef.current = true;
            setAudioPlayingUI(true);
            setCurrentAudio(pageAudio);
            setIsAudioLoading(false);
          })
          .catch(err => {
            if (isCancelled) return;
            console.error('[BookPage] Audio play failed:', err);
            globalAudioPlayingRef.current = false;
            setAudioPlayingUI(false);
            setIsAudioLoading(false);
          });
      };

      audio.onended = handleAudioEnd;
      audio.onerror = () => {
        if (isCancelled) return;
        console.error('[BookPage] Audio error on page', currentPageId);
        setIsAudioLoading(false);
        // On error, auto-advance so the book doesn't stall
        handleAudioEnd();
      };

      // canplaythrough is the reliable trigger for desktop
      audio.oncanplaythrough = attemptPlay;

      // ── Mobile fallback ───────────────────────────────────────────────────
      // On iOS/Android, canplaythrough sometimes never fires for remote URLs.
      // After 2s, try playing anyway — the browser will buffer as needed.
      const mobilePlayFallback = setTimeout(() => {
        if (!globalAudioPlayingRef.current && !isCancelled) {
          console.log('[BookPage] canplaythrough timeout — attempting fallback play');
          attemptPlay();
        }
      }, 2000);

      audio.oncanplaythrough = () => {
        clearTimeout(mobilePlayFallback);
        attemptPlay();
      };

      audio.load();
    };

    playAudio();

    return () => {
      isCancelled = true;
      stopCurrentAudio();
    };
  }, [currentPageId, readingMode, selectedNarration, bookPages.length, bookId]);

  // ── Recording ───────────────────────────────────────────────────────────────
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
    if (!hasPermission || isRecording) return;
    setIsRecording(true);
    setShowOverlay(false);
    sessionStorage.setItem(`overlayDismissed_${bookId}`, "true");
    setReadingMode("record");
    await VoiceRecorder.startRecording();
    isInitialRecordPage.current = false;
  };

  const stopRecording = async () => {
    const result = await VoiceRecorder.stopRecording();
    setIsRecording(false);
    if (result.value?.recordDataBase64) {
      const base64Data = result.value.recordDataBase64;
      const mimeType   = result.value.mimeType || 'audio/mp4';
      setAudioURL(`data:${mimeType};base64,${base64Data}`);
      const bytes = atob(base64Data);
      const arr   = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      const blob = new Blob([arr], { type: mimeType });
      setCurrentBlob(blob);
      return blob;
    }
    return null;
  };

  const deleteAudio = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
        if (document.body.contains(previewAudioRef.current))
          document.body.removeChild(previewAudioRef.current);
      }
      previewAudioRef.current = null;
      setIsPreviewPlaying(false);
    }
    setAudioURL("");
    setCurrentBlob(null);
  };

  // ── Upload ──────────────────────────────────────────────────────────────────
  const uploadAudio = async (blob, page) => {
    if (!blob) return;
    const token = await tokenManager.getToken();
    if (!token) { alert("Session error. Please restart the app."); return; }

    const mimeType  = blob.type || 'audio/mp4';
    const extension = mimeType.includes('mp4') ? '.m4a' : '.aac';
    const fileName  = `${narratorName}_${page}${extension}`;
    const formData  = new FormData();
    formData.append("audio_path",  new File([blob], fileName, { type: mimeType }));
    formData.append("book_id",     bookId);
    formData.append("page_number", page);
    formData.append("narrator",    narratorName);

    try {
      const response = await fetch(
        "https://kithia.com/website_b5d91c8e/api/audio/upload",
        { method: "POST", headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, body: formData }
      );
      const result = await response.json();
      if (response.ok) {
        setMyAudios(prev => ({
          ...prev,
          [narratorName]: {
            ...prev[narratorName],
            [page]: { url: result.audio_url, name: narratorName, narrator: narratorName, id: result.audio?.id },
          },
        }));
        const narRes = await fetch(
          `https://kithia.com/website_b5d91c8e/api/audio/complete-narrators/${bookId}`,
          { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
        );
        if (narRes.ok) {
          const d = await narRes.json();
          setCompleteNarrators(d.complete_narrators   || []);
          setIncompleteNarrators(d.incomplete_narrators || []);
        }
      } else if (response.status === 401) {
        await tokenManager.removeToken();
        alert("Session expired. Please restart the app.");
      } else if (response.status === 413) {
        alert("Audio file too large. Please try a shorter recording.");
      } else {
        alert(result.errors?.audio_path?.[0] || result.message || "Upload failed.");
      }
    } catch (err) {
      console.error('[BookPage] Upload error:', err);
      alert("Network error. Please check your connection.");
    }
  };

  useEffect(() => {
    if (uploadQueue.current.length === 0) return;
    const processQueue = async () => {
      const item = uploadQueue.current.shift();
      await uploadAudio(item.blob, item.page);
      if (uploadQueue.current.length > 0) processQueue();
    };
    processQueue();
  }, [uploadQueue.current.length]);

  // ── Preview playback ────────────────────────────────────────────────────────
  const playCurrent = async () => {
    if (!audioURL) return;
    if (previewAudioRef.current && !previewAudioRef.current.paused) {
      previewAudioRef.current.pause();
      setIsPreviewPlaying(false);
      return;
    }
    try {
      const audio = new Audio();
      audio.src   = audioURL;
      audio.volume = narrationVolume || 1;
      audio.preload = 'auto';
      previewAudioRef.current = audio;
      audio.addEventListener('ended', () => setIsPreviewPlaying(false));
      audio.addEventListener('error', () => { setIsPreviewPlaying(false); });
      audio.addEventListener('canplaythrough', () => {
        audio.play().then(() => setIsPreviewPlaying(true)).catch(() => setIsPreviewPlaying(false));
      });
      audio.load();
      if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios')
        document.body.appendChild(audio);
    } catch (err) {
      console.error('[BookPage] Preview setup failed:', err);
      setIsPreviewPlaying(false);
    }
  };

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleShowContinueModal = () => setShowContinueModal(true);
  const handleEndingModalClose  = () => setShowEndingModal(false);
  const handleContinue          = () => { setShowContinueModal(false); startRecording(); };
  const handleStartNew          = () => { setShowContinueModal(false); deleteAudio(); startRecording(); };

  // ── RECORDING RESUME FIX ────────────────────────────────────────────────────
  // When user clicks a draft, we navigate to the correct page AND automatically
  // start recording so they can continue where they left off immediately.
  const navigateToDraft = async (narrator, pageNum) => {
    // Set narrator name first so recording is attributed correctly
    setNarratorName(narrator);
    localStorage.setItem("narratorName", narrator);

    isInitialRecordPage.current = true;
    setShowOverlay(false);
    sessionStorage.setItem(`overlayDismissed_${bookId}`, "true");
    setReadingMode("record");

    // Navigate to the first unrecorded page for this narrator
    setCurrentPageId(pageNum);

    // Auto-start recording after a short delay for page transition
    setTimeout(async () => {
      await startRecording();
    }, 400);
  };

  const goToPage = async (newPageId) => {
    if (newPageId < 1) return;

    if (newPageId > bookPages.length) {
      let blob = null;
      if (readingMode === "record") {
        if (isRecording) blob = await stopRecording();
        const uploadBlob = blob || currentBlob;
        if (!uploadBlob && !myAudios[narratorName]?.[currentPageId]) {
          alert("Please record this page before finishing.");
          return;
        }
        if (uploadBlob) { uploadQueue.current.push({ blob: uploadBlob, page: currentPageId }); deleteAudio(); }
      }
      setShowEndingModal(true);
      return;
    }

    const isNext = newPageId > currentPageId;

    if (isNext && (readingMode === "read" || readingMode === "listen")) {
      const page = bookPages[newPageId - 1];
      if (!page) return;
      const imgOk = !!preloadedImages[newPageId];
      const txtOk = !!page.words;
      let   audOk = true;
      // In listen mode only block if we have a narration selected and it's not loaded
      if (readingMode === "listen" && selectedNarration) {
        if      (selectedNarration === "professional") audOk = !!professionalAudios[newPageId];
        else                                          audOk = !!myAudios[selectedNarration]?.[newPageId];
      }
      if (!imgOk || !txtOk || !audOk) return;
    }

    if (isNext && readingMode === "record") {
      let blob = null;
      if (isRecording) blob = await stopRecording();
      const uploadBlob = blob || currentBlob;
      if (!uploadBlob && !myAudios[narratorName]?.[currentPageId]) {
        alert("Please record this page first.");
        return;
      }
      if (uploadBlob) { uploadQueue.current.push({ blob: uploadBlob, page: currentPageId }); deleteAudio(); }
    }

    setIsTransitioning(true);
    setCurrentPageId(newPageId);
    if (isNext && readingMode === "record") {
      setTimeout(() => startRecording(), 100);
    }
  };

  const handleModeSelect = (mode) => {
    if (mode === "record") isInitialRecordPage.current = true;
    if (mode === "read") {
      setReadingMode("read");
      setShowOverlay(false);
      sessionStorage.setItem(`overlayDismissed_${bookId}`, "true");
    } else if (mode === "record") {
      setReadingMode("record");
      setShowOverlay(false);
      sessionStorage.setItem(`overlayDismissed_${bookId}`, "true");
    }
    // listen: stays in overlay until narration chosen via handlePlayNarration
  };

  const handlePlayNarration = async (narrator, type) => {
    if (globalAudioRef.current) {
      globalAudioRef.current.pause();
      globalAudioPlayingRef.current = false;
    }
    const key = type === "professional" ? "professional" : narrator;
    setSelectedNarration(key);
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
        .then(() => { globalAudioPlayingRef.current = true; setAudioPlayingUI(true); })
        .catch(err => console.error('[BookPage] pause/play:', err));
    }
  };

  const handleHomeClick = () => setShowModal(true);

  const handleConfirmHomeNavigation = async () => {
    if (isRecording) { await stopRecording(); deleteAudio(); }
    else if (currentBlob && readingMode === "record") {
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
    if (isRecording) { await stopRecording(); deleteAudio(); }
    else if (currentBlob && readingMode === "record") {
      uploadQueue.current.push({ blob: currentBlob, page: currentPageId });
    }
    setReadingMode(null);
    setSelectedNarration(null);
    setCurrentAudio(null);
    setShowOverlay(true);
    setShowModal(false);
    setCurrentPageId(1);
    handleEndingModalClose();
    isInitialRecordPage.current = true;
  };

  useEffect(() => {
    return () => {
      if (globalAudioRef.current) { globalAudioRef.current.pause(); globalAudioRef.current = null; }
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
          if (document.body.contains(previewAudioRef.current))
            document.body.removeChild(previewAudioRef.current);
        }
        previewAudioRef.current = null;
      }
    };
  }, [bookId]);

  // ── Variants + modal body class ────────────────────────────────────────────
  const sentences      = currentPage?.words?.split(/\. ?/).filter(Boolean) || [];
  const headerVariants = { visible: { opacity: 1, y: 0 }, hidden: { opacity: 0, y: -50 } };
  const footerVariants = { visible: { opacity: 1, y: 0 }, hidden: { opacity: 0, y:  50 } };
  const backdropVariants = {
    hidden:  { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.3 } },
    exit:    { opacity: 0, transition: { duration: 0.2 } },
  };
  const modalVariants = {
    hidden:  { opacity: 0, y: -100, scale: 0.8 },
    visible: { opacity: 1, y: 0,    scale: 1, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
    exit:    { opacity: 0, y: -50,  scale: 0.9, transition: { duration: 0.3 } },
  };

  useEffect(() => {
    if (showModal || showContinueModal) document.body.classList.add('modal-open');
    else                               document.body.classList.remove('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, [showModal, showContinueModal]);

  return (
    <div className="book-page-container" onClick={handleScreenTap} style={{ cursor: 'pointer' }}>

      <div className="book-page-background-container">
        {!isLoading && previousPage && (
          <motion.div
            key={`bg-prev-${previousPage.page_number}`}
            className="book-page-background"
            style={{ backgroundImage: `url(${preloadedImages[previousPage.page_number] || (previousPage.image ? `${imageBaseUrl}${previousPage.image}` : "")})` }}
            initial={{ opacity: 1 }} animate={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
          />
        )}
        {!isLoading && currentPage && (
          <motion.div
            key={`bg-cur-${currentPage.page_number}`}
            className="book-page-background"
            style={{ backgroundImage: `url(${preloadedImages[currentPage.page_number] || (currentPage.image ? `${imageBaseUrl}${currentPage.image}` : "")})` }}
            initial={{ opacity: 0.6 }} animate={{ opacity: 1 }}
            transition={{ duration: 1.8, ease: "easeInOut" }}
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
          initial="visible" animate={isClearedView ? "hidden" : "visible"}
          variants={headerVariants} transition={{ duration: 0.5, ease: "easeInOut" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="left-icon-container">
            <img className="book-nav-icon" src={homeIcon} onClick={handleHomeClick} alt="Home" />
            <div className="page-number">{currentPageId}/{bookPages.length}</div>
          </div>
          <div className="middle-icon-container">
            {readingMode === "read" && (
              <div className="volume-bar">
                <input type="range" min="0" max="1" step="0.01" value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))} className="volume-slider" />
              </div>
            )}
            {readingMode === "listen" && (
              <>
                <div className="pause-play-icons">
                  {audioPlayingUI
                    ? <FaPause onClick={toggleNarrationPause} className="pause-play-icon" />
                    : <FaPlay  onClick={toggleNarrationPause} className="pause-play-icon" />}
                </div>
                <div className="volume-bar">
                  <input type="range" min="0" max="1" step="0.01" value={volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))} className="volume-slider" />
                </div>
              </>
            )}
            {readingMode === "record" && (
              <div className="record-controls">
                {isRecording
                  ? <button className="record-button stop" onClick={stopRecording}>■</button>
                  : <button className="record-button start"
                      onClick={() => audioURL ? handleShowContinueModal() : startRecording()}>●</button>
                }
                <span className="recording-timer">{formatTime(recordingTime)}</span>
                <button className={`playback-button ${isRecording || !audioURL ? 'disabled' : ''}`}
                  onClick={playCurrent} disabled={isRecording || !audioURL}>
                  {isPreviewPlaying ? <FaPause /> : <FaPlay />}
                </button>
              </div>
            )}
          </div>
          <div className="right-icon-container">
            <img className="book-nav-icon" onClick={toggleMusic}
              src={isMusicPlaying ? musicIcon : StopMusicIcon} alt="Music" />
          </div>
        </motion.div>
      )}

      {!showOverlay && (
        <motion.div
          className="navigation-and-text-container"
          initial="visible" animate={isClearedView ? "hidden" : "visible"}
          variants={footerVariants} transition={{ duration: 0.5, ease: "easeInOut" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="navigation-and-text">
            <button className="nav-btn left-btn"
              onClick={(e) => { e.stopPropagation(); goToPage(currentPageId - 1); }} />
            <AnimatePresence mode="wait">
              <div key={`text-${currentPageId}`} className="page-text">
                {sentences.length > 0
                  ? sentences.map((s, i) => (
                    <motion.p key={i}
                      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.8 }}>
                      {s.trim()}.
                    </motion.p>
                  ))
                  : <p></p>}
              </div>
            </AnimatePresence>
            <button className="nav-btn right-btn"
              onClick={(e) => { e.stopPropagation(); goToPage(currentPageId + 1); }}
              disabled={readingMode !== "record" && !isPageAssetsLoaded} />
          </div>
        </motion.div>
      )}

      {showOverlay && (
        <motion.div className="action-overlay"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}
          onClick={(e) => e.stopPropagation()}>
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
          <motion.div className="modal-backdrop" variants={backdropVariants}
            initial="hidden" animate="visible" exit="exit" onClick={() => setShowModal(false)}>
            <motion.div className="modal-dialog modal-dialog-centered" role="document"
              variants={modalVariants} initial="hidden" animate="visible" exit="exit"
              onClick={(e) => e.stopPropagation()}>
              <div className="modal-content custom-popup">
                <div className="popup-modal-body">
                  <MdCancel className="custom-btn-cancel" onClick={() => setShowModal(false)} />
                  <h5 className="custom-title">GO TO</h5>
                  <motion.div className="custom-btn-yes" onClick={showOverlayAgain}
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <img src={readIconWhite} alt="Read" />
                    <p className="ps-2">The beginning</p>
                  </motion.div>
                  <motion.div className="custom-btn-yes" onClick={handleConfirmHomeNavigation}
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <img src={libraryIconWhite} alt="Library" />
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
          <motion.div className="modal-backdrop" variants={backdropVariants}
            initial="hidden" animate="visible" exit="exit" onClick={() => setShowContinueModal(false)}>
            <motion.div className="modal-dialog modal-dialog-centered" role="document"
              variants={modalVariants} initial="hidden" animate="visible" exit="exit"
              onClick={(e) => e.stopPropagation()}>
              <div className="modal-content custom-popup">
                <div className="popup-modal-body">
                  <MdCancel className="custom-btn-cancel" onClick={() => setShowContinueModal(false)} />
                  <h5 className="custom-title">You have an unsaved recording</h5>
                  <motion.div className="custom-btn-yes" onClick={handleContinue}
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <p>Continue with the recording</p>
                  </motion.div>
                  <motion.div className="custom-btn-yes" onClick={handleStartNew}
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
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