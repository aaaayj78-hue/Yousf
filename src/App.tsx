import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { HistoryItem } from "./types";
import { VoiceSelector } from "./components/VoiceSelector";
import { TtsForm } from "./components/TtsForm";
import { AudioHistory } from "./components/AudioHistory";
import {
  base64ToArrayBuffer,
  pcmToAudioBuffer,
  pcmToWavBlob,
  dialectOptions,
  toneOptions,
  voiceOptions,
} from "./utils/audio";
import {
  Volume2,
  Download,
  Play,
  Pause,
  RefreshCw,
  AlertCircle,
  HelpCircle,
  Github,
  Award,
  Mic,
  Undo2,
  Info,
  Sparkles,
  Settings,
  Video,
  Upload,
  CheckCircle2,
  FileAudio,
  Users,
  MessageSquare,
  Sun,
  Moon,
} from "lucide-react";

export default function App() {
  // Main form states
  const [text, setText] = useState<string>("فَسَيَكْفِيكَهُمُ اللَّهُ ۚ وَهُوَ السَّمِيعُ الْعَلِيمُ");
  const [selectedDialect, setSelectedDialect] = useState<string>(dialectOptions[1].id); // default to Iraqi
  const [selectedTone, setSelectedTone] = useState<string>(toneOptions[0].id); // default to calm
  const [selectedVoice, setSelectedVoice] = useState<string>("iraqi-young-smart");
  const [selectedGender, setSelectedGender] = useState<string>("شاب عراقي ذكي ومتسق (صوت متوسط)");
  const [engine, setEngine] = useState<"gemini" | "google" | "browser">("gemini");
  const [useSmartAnalysis, setUseSmartAnalysis] = useState<boolean>(true);
  const [premiumUsed, setPremiumUsed] = useState<number>(0);
  const [customApiKeys, setCustomApiKeys] = useState<string[]>([]);
  
  // Theme management state
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const savedTheme = localStorage.getItem("app_theme") as "light" | "dark" | null;
    const initialTheme = savedTheme || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(initialTheme);
    if (initialTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("app_theme", nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem("premium_attempts_used");
    if (saved) {
      setPremiumUsed(parseInt(saved, 10) || 0);
    }
  }, []);

  const incrementPremiumUsage = () => {
    setPremiumUsed(prev => {
      const next = prev + 1;
      localStorage.setItem("premium_attempts_used", next.toString());
      return next;
    });
  };

  const newKeyInputRef = useRef<HTMLInputElement>(null);
  const [newKeyInput, setNewKeyInput] = useState<string>("");
  const [showKeysPanel, setShowKeysPanel] = useState<boolean>(false);

  // Navigation state
  const [activeTab, setActiveTab ] = useState<"tts" | "dub">("tts");

  // Dubbing specific states
  const [dubFile, setDubFile] = useState<File | null>(null);
  const [dubFileName, setDubFileName] = useState<string>("");
  const [dubFileBase64, setDubFileBase64] = useState<string | null>(null);
  const [dubFileMimeType, setDubFileMimeType] = useState<string | null>(null);
  const [dubFileUrl, setDubFileUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!dubFile) {
      setDubFileUrl(null);
      return;
    }
    const url = URL.createObjectURL(dubFile);
    setDubFileUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [dubFile]);
  const [isDubbing, setIsDubbing] = useState<boolean>(false);
  const [dubbingResult, setDubbingResult] = useState<{
    hasSpeech: boolean;
    originalLanguage: string;
    transcription: string;
    arabicTranslation: string;
    scenesSummary: string;
    audioData: string;
    isMp3?: boolean;
    voiceFeedback?: string;
  } | null>(null);
  const [dubAudioUrl, setDubAudioUrl] = useState<string | null>(null);
  const [isOriginalAudioMuted, setIsOriginalAudioMuted] = useState<boolean>(true);
  const [dubPlayState, setDubPlayState] = useState<"playing" | "paused" | "stopped">("stopped");

  // Video Merging status states
  const [isMergingVideo, setIsMergingVideo] = useState<boolean>(false);
  const [mergingProgress, setMergingProgress] = useState<number>(0);
  const [mergedVideoUrl, setMergedVideoUrl] = useState<string | null>(null);

  // Statuses
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // History logs
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Browser Audio context instances
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const nativeAudioRef = useRef<HTMLAudioElement | null>(null);
  const dubOriginalMediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  const [playingItem, setPlayingItem] = useState<HistoryItem | null>(null);
  const [playState, setPlayState] = useState<"playing" | "paused" | "stopped">("stopped");
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);

  // Load saved history and custom API keys on startup
  useEffect(() => {
    const saved = localStorage.getItem("arabic_tts_history");
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history from localStorage", e);
      }
    }

    const savedKeys = localStorage.getItem("custom_gemini_keys");
    if (savedKeys) {
      try {
        setCustomApiKeys(JSON.parse(savedKeys));
      } catch (e) {
        console.error("Failed to parse custom keys from localStorage", e);
      }
    }
  }, []);

  // Save history to localStorage
  const saveHistoryToStorage = (updatedList: HistoryItem[]) => {
    // Keep a maximum of 8 items to prevent exceeding the browser's 5MB localStorage quota limit
    const trimmedList = updatedList.slice(0, 8);
    try {
      localStorage.setItem("arabic_tts_history", JSON.stringify(trimmedList));
    } catch (e) {
      console.warn("Storage quota exceeded, trimming history list further to 4 items", e);
      try {
        localStorage.setItem("arabic_tts_history", JSON.stringify(trimmedList.slice(0, 4)));
      } catch (innerE) {
        console.error("Failed to store even 4 items, storing lightweight text-only items to preserve history index", innerE);
        const lightweightList = trimmedList.map((item) => ({ ...item, audioData: "" }));
        try {
          localStorage.setItem("arabic_tts_history", JSON.stringify(lightweightList.slice(0, 8)));
        } catch (err) {
          console.error("Local storage completely failed to save history:", err);
        }
      }
    }
    setHistory(trimmedList);
  };

  // Save custom api keys to localStorage
  const saveCustomApiKeys = (keys: string[]) => {
    localStorage.setItem("custom_gemini_keys", JSON.stringify(keys));
    setCustomApiKeys(keys);
  };

  // Human readables finder
  const getDialectLabel = () => {
    const d = dialectOptions.find((x) => x.id === selectedDialect);
    return d ? d.label : "لهجة محلية";
  };

  const getToneLabel = () => {
    const t = toneOptions.find((x) => x.id === selectedTone);
    return t ? t.label : "انفعال عادي";
  };

  // Audio Playback Engine
  const stopPcm = () => {
    if (nativeAudioRef.current) {
      try {
        nativeAudioRef.current.pause();
        nativeAudioRef.current.src = "";
      } catch (e) {
        // already stopped
      }
      nativeAudioRef.current = null;
    }
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch (e) {
        // already stopped
      }
      sourceNodeRef.current = null;
    }
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
    setCurrentlyPlayingId(null);
    setPlayingItem(null);
    setPlayState("stopped");
  };

  const speakWithBrowserSpeech = (
    textToSpeak: string,
    dialectOption: string,
    genderOption: string,
    itemId: string,
    itemObj: HistoryItem
  ) => {
    if (!('speechSynthesis' in window)) {
      setError("عذراً، متصفحك أو جهازك لا يدعم تحويل النصوص إلى كلام محلياً.");
      return;
    }

    try {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      const voices = window.speechSynthesis.getVoices();
      const arabicVoices = voices.filter((v) => v.lang.startsWith("ar"));

      let langCode = "ar-SA";
      if (dialectOption.includes("العراق")) langCode = "ar-IQ";
      else if (dialectOption.includes("السعودي")) langCode = "ar-SA";
      else if (dialectOption.includes("إمارات")) langCode = "ar-AE";
      else if (dialectOption.includes("مصر")) langCode = "ar-EG";
      else if (dialectOption.includes("شام") || dialectOption.includes("سوري")) langCode = "ar-SY";

      utterance.lang = langCode;

      let targetVoice = arabicVoices.find((v) => v.lang.toLowerCase() === langCode.toLowerCase());
      if (!targetVoice) {
        targetVoice = arabicVoices[0];
      }
      if (targetVoice) {
        utterance.voice = targetVoice;
      }

      // Voice settings adjustments based on selected options
      if (genderOption.includes("طفل")) {
        utterance.pitch = 1.35;
        utterance.rate = 1.05;
      } else if (genderOption.includes("وقور")) {
        utterance.pitch = 0.85;
        utterance.rate = 0.85;
      } else if (genderOption.includes("شابة")) {
        utterance.pitch = 1.15;
        utterance.rate = 1.0;
      } else {
        utterance.pitch = 1.0;
        utterance.rate = 1.0;
      }

      utterance.rate = utterance.rate * playbackSpeed;

      utterance.onstart = () => {
        setCurrentlyPlayingId(itemId);
        setPlayingItem(itemObj);
        setPlayState("playing");
      };

      utterance.onend = () => {
        setCurrentlyPlayingId(null);
        setPlayingItem(null);
        setPlayState("stopped");
      };

      utterance.onerror = (e) => {
        console.error("SpeechSynthesis error:", e);
        setCurrentlyPlayingId(null);
        setPlayingItem(null);
        setPlayState("stopped");
      };

      window.speechSynthesis.speak(utterance);
    } catch (err: any) {
      console.error("SpeechSynthesis initiation error:", err);
    }
  };

  const playPcm = (item: HistoryItem) => {
    stopPcm();

    if (item.audioData === "BROWSER_SYNTHESIS") {
      speakWithBrowserSpeech(item.text, item.dialect, item.gender, item.id, item);
      return;
    }

    try {
      let url = "";

      if (item.isMp3) {
        const arrayBuf = base64ToArrayBuffer(item.audioData);
        const blob = new Blob([arrayBuf], { type: "audio/mp3" });
        url = URL.createObjectURL(blob);
      } else {
        // Raw 16-bit PCM Mono from Gemini, converted to a standardized playable WAV blob
        const arrayBuf = base64ToArrayBuffer(item.audioData);
        const wavBlob = pcmToWavBlob(arrayBuf, 24000);
        url = URL.createObjectURL(wavBlob);
      }

      const audio = new Audio(url);
      audio.playbackRate = playbackSpeed;

      audio.onplay = () => {
        setCurrentlyPlayingId(item.id);
        setPlayingItem(item);
        setPlayState("playing");
      };

      audio.onended = () => {
        setCurrentlyPlayingId(null);
        setPlayingItem(null);
        setPlayState("stopped");
        URL.revokeObjectURL(url);
      };

      audio.onerror = (e) => {
        console.error("Native HTML5 Audio error:", e);
        setCurrentlyPlayingId(null);
        setPlayingItem(null);
        setPlayState("stopped");
        URL.revokeObjectURL(url);
      };

      nativeAudioRef.current = audio;
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn("Audio element play rejected. Requires user gesture or volume enabled.", err);
        });
      }
    } catch (err: any) {
      console.error("Playback engine instantiation error:", err);
      setError("حدث خطأ أثناء رغبتك بالاستماع للملف الصوتي: " + (err.message || err));
    }
  };

  // Adjust playback speed dynamically
  const changeSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    if (nativeAudioRef.current) {
      nativeAudioRef.current.playbackRate = speed;
    }
    if (sourceNodeRef.current && playState === "playing") {
      sourceNodeRef.current.playbackRate.value = speed;
    }
  };

  // Create & Trigger WAV File Download
  const handleDownload = (item: HistoryItem) => {
    try {
      const arrayBuf = base64ToArrayBuffer(item.audioData);
      const wavBlob = pcmToWavBlob(arrayBuf, 24000);
      const url = URL.createObjectURL(wavBlob);

      const a = document.createElement("a");
      a.href = url;
      // Crop speech to 15 chars for clean filename
      const truncatedText = item.text.slice(0, 15).replace(/[^\w\s\u0600-\u06FF]/g, "");
      a.download = `صوت_ذكي_${truncatedText}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Download error:", err);
      setError("فشل تحميل الملف الصوتي: " + (err.message || err));
    }
  };

  // Delete individual history item
  const handleDeleteHistoryItem = (id: string) => {
    if (currentlyPlayingId === id) {
      stopPcm();
    }
    const updated = history.filter((item) => item.id !== id);
    saveHistoryToStorage(updated);
  };

  // Clear all history
  const handleClearAllHistory = () => {
    if (window.confirm("هل أنت متأكد من رغبتك في حذف السجل بالكامل؟ لا يمكن التراجع عن هذه الخطوة.")) {
      stopPcm();
      saveHistoryToStorage([]);
    }
  };

  // Submit audio generation request with Smart Analysis & API Keys Rotation
  const handleSubmitTts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    setIsGenerating(true);
    setError(null);
    setSuccessMsg(null);
    stopPcm();

    const textToProcess = text.trim();
    let finalProcessedText = textToProcess;

    const keysList = customApiKeys.length > 0 ? customApiKeys : [""]; // "" represents default system key

    // 1. Run the Smart AI Text Pre-Analyzer and Diacritizer if enabled
    if (useSmartAnalysis) {
      setSuccessMsg("جاري قياس عمق الكلمات وتشكيل وضبط النص ذكياً قبل النطق... 🧠");
      try {
        const analysisKey = keysList[0];
        const anaRes = await fetch("/api/analyze-text", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            ...(analysisKey ? { "X-Gemini-Key": analysisKey } : {})
          },
          body: JSON.stringify({ 
            text: textToProcess,
            dialect: selectedDialect,
            tone: selectedTone
          }),
        });
        if (anaRes.ok) {
          const anaData = await anaRes.json();
          if (anaData.success && anaData.text) {
            finalProcessedText = anaData.text;
            console.log("AI Analyzer success:", finalProcessedText);
          }
        }
      } catch (anaErr) {
        console.warn("Smart diacritics failed, using original text", anaErr);
      }
    }

    // 2. Browser engine (Local Web Speech API)
    if (engine === "browser") {
      try {
        const newItem: HistoryItem = {
          id: Math.random().toString(36).substring(2, 9),
          text: finalProcessedText,
          dialect: selectedDialect,
          textOriginal: textToProcess,
          tone: selectedTone,
          voiceName: selectedVoice,
          gender: selectedGender,
          timestamp: new Date().toISOString(),
          audioData: "BROWSER_SYNTHESIS",
        };

        const updatedHistory = [newItem, ...history];
        saveHistoryToStorage(updatedHistory);
        setSuccessMsg("تم النطق بنجاح باستخدام مخارج الصوت والألحان المحلية للمتصفح!");

        setTimeout(() => {
          playPcm(newItem);
        }, 100);
      } catch (browserErr: any) {
        console.error(browserErr);
        setError("فشل النطق عبر المتصفح: " + (browserErr.message || browserErr));
      } finally {
        setIsGenerating(false);
      }
      return;
    }

    // 3. Google Translate Unlimited TTS Engine
    if (engine === "google") {
      try {
        const response = await fetch("/api/unlimited-tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: finalProcessedText }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "فشل توليد الصوت عبر محرك النطق السحابي من جوجل.");
        }

        const newItem: HistoryItem = {
          id: Math.random().toString(36).substring(2, 9),
          text: finalProcessedText,
          textOriginal: textToProcess,
          dialect: getDialectLabel() || "العربية الفصحى",
          tone: getToneLabel() || "واضح ومتزن",
          voiceName: "محرك جوجل الفوري",
          gender: "نبرة واضحة ومخارج ممتازة",
          timestamp: new Date().toISOString(),
          audioData: data.audioData,
          isMp3: true,
        };

        const updatedHistory = [newItem, ...history];
        saveHistoryToStorage(updatedHistory);
        setSuccessMsg("تم تحويل وتشكيل النص لغوياً ثم نطقه بسلاسة فائقة عبر خوادم جوجل السريعة!");

        setTimeout(() => {
          playPcm(newItem);
        }, 100);

      } catch (googleErr: any) {
        console.error(googleErr);
        setError("فشل النطق عبر محرك التحويل السحابي اللامحدود: " + (googleErr.message || googleErr));
      } finally {
        setIsGenerating(false);
      }
      return;
    }

    // 4. Gemini Cloud TTS premium engine with seamless Multi-Key Rotation
    let keySuccess = false;
    let lastError = "";

    for (let i = 0; i < keysList.length; i++) {
      const activeKey = keysList[i];
      const keyLabel = activeKey ? `مفتاحك المضاف #${i + 1}` : "مفتاح الخادم المجاني";

      try {
        console.log(`Trying sound generation with key: ${keyLabel}`);
        
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            ...(activeKey ? { "X-Gemini-Key": activeKey } : {})
          },
          body: JSON.stringify({
            text: finalProcessedText,
            dialect: selectedDialect,
            tone: selectedTone,
            voiceName: selectedVoice,
            gender: selectedGender,
          }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          const newItem: HistoryItem = {
            id: Math.random().toString(36).substring(2, 9),
            text: finalProcessedText,
            textOriginal: textToProcess,
            dialect: selectedDialect,
            tone: selectedTone,
            voiceName: selectedVoice,
            gender: selectedGender,
            timestamp: new Date().toISOString(),
            audioData: data.audioData,
          };

          const updatedHistory = [newItem, ...history];
          saveHistoryToStorage(updatedHistory);
          
          if (engine === "gemini") {
            incrementPremiumUsage();
          }

          let successAlert = "تمت محاكاة تعابير الوجه والنبرة الصوتية لـ Gemini ونطقها بنجاح!";
          if (activeKey) {
            successAlert += ` (تمت المعالجة عبر مفتاح الـ API الخاص بك #${i + 1})`;
          }
          setSuccessMsg(successAlert);

          setTimeout(() => {
            playPcm(newItem);
          }, 200);

          keySuccess = true;
          break; // break the keys loop since we succeeded
        } else {
          lastError = data.error || "فشل توليد نطق عاطفي.";
          console.warn(`Key rotation: ${keyLabel} failed with error: ${lastError}`);
        }
      } catch (err: any) {
        lastError = err.message || err;
        console.warn(`Key rotation: ${keyLabel} threw an exception: ${lastError}`);
      }
    }

    // 5. If all Gemini API keys failed or were depleted, explain the issue with exact count of attempted keys
    if (!keySuccess) {
      console.warn("All keys exhausted or failed.");
      setError(`⚠️ عذراً، نفدت كلياً محاولات النطق عبر خوادم الجوزاء لجميع المفاتيح المتاحة (تم اختبار وتدوير عدد ${keysList.length} مفاتيح في الصندوق). السبب الأخير للخطأ: ${lastError}. لتجنب ذلك، يرجى تزويدنا بمفاتيح إضافية في صندوق التدوير بالأسفل، أو التحويل يدوياً ومباشرة إلى خيار "جوجل بلس الذكي واللامحدود (مجاني)" من الأعلى لمتابعة العمل مجاناً وبلا أي قيود!`);
    }
    
    setIsGenerating(false);
  };

  // Dub play elements refs
  const dubAudioRef = useRef<HTMLAudioElement | null>(null);

  const handleDubFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 25 * 1024 * 1024) {
        setError("⚠️ حجم الملف يتجاوز الـ 25 ميجابايت. الرجاء رفع ملف أصغر لضمان دقة الدبلجة وسرعتها.");
        return;
      }
      setDubFile(file);
      setDubFileName(file.name);
      setDubFileMimeType(file.type);
      setError(null);
      setSuccessMsg(null);
      setDubbingResult(null);

      const reader = new FileReader();
      reader.onloadend = () => {
        setDubFileBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const [editedScript, setEditedScript] = useState<string>("");

  const handleStartDubbing = async (manualScript?: string | React.MouseEvent) => {
    if (!dubFileBase64 || !dubFileMimeType) {
      setError("الرجاء تحديد ملف مرئي أو مسموع لرفع ودبلجة المقطع.");
      return;
    }

    const isManualOverride = typeof manualScript === 'string' && manualScript.trim().length > 0;

    setIsDubbing(true);
    setError(null);
    setSuccessMsg(null);
    // Only clear result if not keeping the old one for manual edit
    if (!isManualOverride) {
      setDubbingResult(null);
      setEditedScript("");
    }

    // Stop current audios playing
    stopPcm();
    if (dubAudioUrl) {
      URL.revokeObjectURL(dubAudioUrl);
      setDubAudioUrl(null);
    }

    // Key Rotation Strategy for Dubbing
    const keysToTry = customApiKeys.length > 0 ? customApiKeys : [ "default" ];
    let keySuccess = false;
    let lastError = "";

    for (let index = 0; index < keysToTry.length; index++) {
      const currentKey = keysToTry[index];
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const keyLabel = currentKey === "default" ? "مفتاح الموقع المدمج" : `المفتاح الخاص والمُدوَّر #${index + 1}`;

      if (currentKey !== "default") {
        headers["x-gemini-key"] = currentKey;
      }

      try {
        const videoDuration = dubOriginalMediaRef.current?.duration || null;
        const payload: any = {
          mediaData: dubFileBase64,
          mimeType: dubFileMimeType,
          dialect: getDialectLabel(),
          tone: getToneLabel(),
          voiceName: selectedVoice,
          gender: selectedGender,
          engine: engine,
          duration: videoDuration,
        };
        if (isManualOverride) {
          payload.editedArabicText = manualScript as string;
        }

        const response = await fetch("/api/dub", {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          keySuccess = true;
          
          if (data.isFallback) {
             setDubbingResult(data);
             // Clear any old audio object since we don't have new audio yet
             setDubAudioUrl(null);
             setError("⚠️ يرجى الانتباه: فشل تحليل الفيديو تلقائياً (إما لنفاد الحصة المجانية للمفتاح أو لأن الفيديو غير مدعوم). تم فتح صندوق سيناريو الدبلجة لتتمكن من كتابة النص يدوياً. اكتب سيناريو الدبلجة ثم اضغط تحديث وسيعمل بشكل ممتاز!");
             setSuccessMsg(null);
             break;
          }

          // Sound building
          const binary = atob(data.audioData);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          
          let blob: Blob;
          if (data.isMp3) {
            blob = new Blob([bytes], { type: "audio/mp3" });
          } else {
            blob = pcmToWavBlob(bytes.buffer, 24000);
          }
          const url = URL.createObjectURL(blob);
          
          setDubAudioUrl(url);
          setDubbingResult(data);
          
          if (engine === "gemini") {
            incrementPremiumUsage();
          }

          setSuccessMsg(`🎉 تم إكمال دبلجة المقطع لغوياً وفنياً من اللغة (${data.originalLanguage || "غير محدد"}) بنجاح! تم استخدام: ${keyLabel}`);
          break; // Key success! Out of rotation.
        } else {
          lastError = data.error || "فشلت دبلجة الملف ذكياً.";
          console.warn(`Dubbing Key depletion/failure triggered on ${keyLabel}: ${lastError}`);
        }
      } catch (err: any) {
        lastError = err.message || err;
        console.warn(`Exception during dubbing on key ${keyLabel}: ${lastError}`);
      }
    }

    if (!keySuccess) {
      setError(`⚠️ عذراً، فشلت عملية الدبلجة السينمائية والترجمة لجميع مفاتيح الاستخدام المتوفرة في صندوق التدوير (تم اختبار عدد ${keysToTry.length} مفتاح). السبب الأخير: ${lastError}. لتفادي ذلك، يمكنك إضافة مفتاح API خاص بك في صندوق التدوير، أو تحديد محرك "جوجل بلس الذكي السريع (مجاني وغير محدود)" من الأعلى للمتابعة مجاناً ودون أي حصص يومية!`);
    }

    setIsDubbing(false);
  };

  const toggleDubAudioPlay = () => {
    if (!dubAudioRef.current) return;
    if (dubPlayState === "playing") {
      dubAudioRef.current.pause();
      if (dubOriginalMediaRef.current) {
        dubOriginalMediaRef.current.pause();
      }
      setDubPlayState("paused");
    } else {
      stopPcm(); // mute main TTS sounds
      
      // Ensure sync
      if (dubOriginalMediaRef.current) {
        const videoDur = dubOriginalMediaRef.current.duration || 0;
        const audioDur = dubAudioRef.current.duration || 0;
        
        if (videoDur > 0 && audioDur > 0) {
          const ratio = videoDur / audioDur;
          if (ratio >= 0.75 && ratio <= 1.35) {
            dubOriginalMediaRef.current.playbackRate = ratio;
          } else {
            dubOriginalMediaRef.current.playbackRate = videoDur > audioDur ? 1.0 : 0.8;
          }
        } else {
          dubOriginalMediaRef.current.playbackRate = 1.0;
        }

        dubOriginalMediaRef.current.currentTime = 0;
        dubOriginalMediaRef.current.play().catch(() => {});
      }
      dubAudioRef.current.currentTime = 0;
      dubAudioRef.current.play().catch(() => {});
      setDubPlayState("playing");
    }
  };

  const stopDubAudioPlay = () => {
    if (dubAudioRef.current) {
      dubAudioRef.current.pause();
      dubAudioRef.current.currentTime = 0;
    }
    if (dubOriginalMediaRef.current) {
      dubOriginalMediaRef.current.pause();
      dubOriginalMediaRef.current.currentTime = 0;
      dubOriginalMediaRef.current.playbackRate = 1.0;
    }
    setDubPlayState("stopped");
  };

  // Merge synchronized audio and video in the browser and download the unified media
  const handleMergeAndDownloadVideo = async () => {
    if (!dubFile || !dubAudioUrl) {
      setError("الرجاء تحديد ملف فيديو والتأكد من إتمام الدبلجة أولاً.");
      return;
    }

    setIsMergingVideo(true);
    setMergingProgress(0);
    setError(null);
    setSuccessMsg(null);

    // Give React a brief tick to paint the live viewport container in the DOM
    await new Promise((resolve) => setTimeout(resolve, 150));

    try {
      // Create off-screen video element to handle recording smoothly
      const recordVideo = document.createElement("video");
      recordVideo.id = "temp-record-video-element";
      recordVideo.src = dubFileUrl || "";
      recordVideo.muted = true; // record silent video
      recordVideo.playsInline = true;
      recordVideo.width = 640;
      recordVideo.height = 360;
      recordVideo.loop = false; // Disable loop to avoid re-playing and repetition bugs

      // Force-paint trick: attach to visible compiler DOM to avoid browser background throttling
      const target = document.getElementById("video-recording-display-target");
      if (target) {
        recordVideo.style.position = "relative";
        recordVideo.style.width = "100%";
        recordVideo.style.height = "100%";
        recordVideo.style.objectFit = "cover";
        recordVideo.style.opacity = "1";
        recordVideo.style.pointerEvents = "none";
        recordVideo.style.borderRadius = "8px";
        target.appendChild(recordVideo);
      } else {
        // Fallback to offscreen fixed if target is missing
        recordVideo.style.position = "fixed";
        recordVideo.style.left = "-9999px";
        recordVideo.style.top = "0";
        recordVideo.style.opacity = "0.01";
        recordVideo.style.pointerEvents = "none";
        recordVideo.style.zIndex = "-9999";
        document.body.appendChild(recordVideo);
      }

      await new Promise<void>((resolve) => {
        recordVideo.onloadedmetadata = () => resolve();
        recordVideo.onerror = () => resolve();
        setTimeout(() => resolve(), 3000);
      });

      const recordAudio = document.createElement("audio");
      recordAudio.src = dubAudioUrl;

      await new Promise<void>((resolve) => {
        recordAudio.onloadedmetadata = () => resolve();
        setTimeout(() => resolve(), 3000);
      });

      // Capture stream
      const streamMethod = ((recordVideo as any).captureStream || (recordVideo as any).mozCaptureStream);
      if (!streamMethod) {
        throw new Error("متصفحك الحالي لا يدعم خاصية التقاط دمج الفيديو برمجياً.");
      }

      const videoStream = streamMethod.call(recordVideo);
      
      // Mix Audio
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioSource = audioCtx.createMediaElementSource(recordAudio);
      const audioDst = audioCtx.createMediaStreamDestination();
      audioSource.connect(audioDst);
      audioSource.connect(audioCtx.destination);

      const mixedStream = new MediaStream();
      videoStream.getVideoTracks().forEach((track) => mixedStream.addTrack(track));
      audioDst.stream.getAudioTracks().forEach((track) => mixedStream.addTrack(track));

      // MediaRecorder options
      let opt = { mimeType: "video/webm;codecs=vp8,opus" };
      if (!MediaRecorder.isTypeSupported(opt.mimeType)) {
        opt = { mimeType: "video/webm" };
      }
      if (!MediaRecorder.isTypeSupported(opt.mimeType)) {
        opt = { mimeType: "video/mp4" };
      }
      if (!MediaRecorder.isTypeSupported(opt.mimeType)) {
        opt = { mimeType: "" };
      }

      const recorder = new MediaRecorder(mixedStream, opt);
      const recordedChunks: Blob[] = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          recordedChunks.push(ev.data);
        }
      };

      recorder.onstop = () => {
        const finalBlob = new Blob(recordedChunks, { type: recordedChunks[0]?.type || "video/webm" });
        const finalUrl = URL.createObjectURL(finalBlob);
        setMergedVideoUrl(finalUrl);
        setIsMergingVideo(false);
        setSuccessMsg("🎉 تهانينا! تم بنجاح دمج الصوت المدبلج وتوليد الفيديو الكامل برنتك المفضلة بنسبة 100%.");

        const downloadLink = document.createElement("a");
        downloadLink.href = finalUrl;
        downloadLink.download = `dubbed_video_${Date.now()}.webm`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

        audioCtx.close();

        // Safe clean up of temporary element
        if (recordVideo.parentNode) {
          recordVideo.parentNode.removeChild(recordVideo);
        }
      };

      // Play and record in sync!
      recordVideo.currentTime = 0;
      recordAudio.currentTime = 0;

      // Handle precise timing sync
      const videoDur = recordVideo.duration || 0;
      const audioDur = recordAudio.duration || 0;
      let targetDuration = audioDur > 0 ? audioDur : 10;

      if (videoDur > 0 && audioDur > 0) {
        const ratio = videoDur / audioDur;
        // If the durations are relatively close (within 25%), scale video playback rate to stretch/shrink perfectly
        if (ratio >= 0.75 && ratio <= 1.35) {
          recordVideo.playbackRate = ratio;
          targetDuration = audioDur;
        } else {
          // Trim the recording exactly when the narration ends if the audio is much shorter
          if (videoDur > audioDur) {
            recordVideo.playbackRate = 1.0;
            targetDuration = audioDur;
          } else {
            // Slower down if narration is much longer and let video freeze at final frame
            recordVideo.playbackRate = 0.8;
            targetDuration = audioDur;
          }
        }
      }

      await recordVideo.play();
      await recordAudio.play();
      recorder.start();

      const intervalId = setInterval(() => {
        const elapsed = recordAudio.currentTime;
        const progress = Math.min(Math.round((elapsed / targetDuration) * 100), 100);
        setMergingProgress(progress);

        if (recordAudio.ended || elapsed >= targetDuration) {
          clearInterval(intervalId);
          recordVideo.pause();
          recordAudio.pause();
          if (recorder.state !== "inactive") {
            recorder.stop();
          }
        }
      }, 150);

      // Safety timeout fallback
      setTimeout(() => {
        clearInterval(intervalId);
        if (recorder.state !== "inactive") {
          recorder.stop();
        }
      }, (targetDuration + 2) * 1000);

    } catch (errorErr: any) {
      console.error(errorErr);
      setError(`⚠️ عذراً، فشلت عملية الدمج التلقائية للوسائط. يمكنك تحميل ملف الدبلجة الصوتي بدلاً من ذلك. السبب: ${errorErr.message || errorErr}`);
      setIsMergingVideo(false);
      const element = document.getElementById("temp-record-video-element");
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans" dir="rtl" id="app-root-container">
      {/* Premium Header Decoration */}
      <header className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-700 flex items-center justify-center text-white shadow-md">
              <Mic className="w-5 h-5" />
            </div>
            <div className="text-right">
              <h1 className="text-lg font-bold tracking-tight text-slate-800 dark:text-slate-100">استديو النطق والترجمة الصوتية الذكية 🎙️</h1>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium font-mono">
                محرك نطق فائق الذكاء بمختلف اللهجات العربية ودبلجة فورية للمقاطع المرئية والصوتية
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              type="button"
              className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors border border-gray-150 dark:border-slate-700 cursor-pointer"
              title={theme === "light" ? "تفعيل الوضع الداكن" : "تفعيل الوضع المضيء"}
              id="theme-toggle-header-btn"
            >
              {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>

            <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-xs px-3 py-1.5 rounded-full font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>مبني على ذكاء Gemini 3.1</span>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 text-xs px-3 py-1.5 rounded-full font-semibold">
              دبلجة ونطق 100% طبيعي
            </div>
          </div>
        </div>
      </header>

      {/* Main Container Layout */}
      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 w-full space-y-8">
        
        {/* Modern Tab Navigation switcher */}
        <div className="flex bg-slate-100 dark:bg-slate-900/60 p-1.5 rounded-2xl max-w-xl mx-auto border border-gray-200/50 dark:border-slate-800/80 shadow-inner">
          <button
            type="button"
            onClick={() => {
              setActiveTab("tts");
              stopDubAudioPlay();
              setError(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "tts"
                ? "bg-white dark:bg-slate-850 text-indigo-600 dark:text-indigo-400 shadow-md scale-[1.01]"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <Mic className="w-4 h-4" />
            <span>نطق النصوص القيافة (TTS)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("dub");
              stopPcm();
              setError(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "dub"
                ? "bg-white dark:bg-slate-850 text-indigo-600 dark:text-indigo-400 shadow-md scale-[1.01]"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <Video className="w-4 h-4" />
            <span>دبلجة الميديا والذكاء الصوتي 🎥</span>
            <span className="bg-gradient-to-r from-indigo-500 to-sky-400 text-white text-[9px] px-2 py-0.5 rounded-full font-bold">جديد</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left column - Selectors & Details (7 cols) */}
          <section className="lg:col-span-12 xl:col-span-8 bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-slate-800 space-y-8">
            <div className="border-b border-gray-100 dark:border-slate-800 pb-5">
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Award className="w-5 h-5 text-indigo-600" />
                {activeTab === "tts" ? "تخصيص اللكنة والنبرة الصوتية المحاكية للمشاعر" : "تخصيص ذكاء وصوت الدبلجة العربية الفورية"}
              </h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 leading-normal">
                اختر بلد اللهجة، واضبط النبرة العاطفية التي سيتم دبلجة أو نطق المقطع بها لتستمع لأداء مميز يليق بالمحتوى والفيلم.
              </p>

              /* Speech Engine Switcher block - Always available for both direct voice synthesis and media dubbing */
              {/* Engine Selection Section with Quota Indicator */}
              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-gray-100 dark:border-slate-800/80 gap-2.5 mt-4 flex flex-col" id="engine-selection-container">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] font-bold bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded-full text-slate-600 dark:text-slate-300">
                    الاستهلاك للمحرك السينمائي: {premiumUsed} محاولة
                  </div>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 text-right">الرجاء اختيار محرك النطق والدبلجة المفضل:</p>
                </div>
                
                <button
                  type="button"
                  onClick={() => setEngine("google")}
                  className={`w-full py-3 px-4 rounded-xl text-xs font-bold transition-all duration-300 flex items-center justify-between gap-3 cursor-pointer border ${
                    engine === "google"
                      ? "bg-emerald-600 dark:bg-emerald-700 text-white border-emerald-500 shadow-md scale-[1.01]"
                      : "bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-850"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${engine === "google" ? "bg-white animate-pulse" : "bg-emerald-500"}`} />
                    <span>جوجل بلس الذكي (مجاني وغير محدود 🚀)</span>
                  </div>
                  {engine === "google" && <span className="text-[10px] bg-emerald-700 text-emerald-100 px-2 py-0.5 rounded-full">نشط</span>}
                </button>

                <button
                  type="button"
                  onClick={() => setEngine("gemini")}
                  className={`w-full py-3 px-4 rounded-xl text-xs font-bold transition-all duration-300 flex items-center justify-between gap-3 cursor-pointer border ${
                    engine === "gemini"
                      ? "bg-indigo-600 dark:bg-indigo-700 text-white border-indigo-500 shadow-md scale-[1.01]"
                      : "bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-850"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${engine === "gemini" ? "bg-white animate-pulse" : "bg-indigo-500"}`} />
                    <span>محرك الجوزاء السينمائي (بلهجات ومشاعر 💎 - 15 محاولة/للمفتاح)</span>
                  </div>
                  {engine === "gemini" && <span className="text-[10px] bg-indigo-700 text-indigo-100 px-2 py-0.5 rounded-full">نشط</span>}
                </button>

                <button
                  type="button"
                  onClick={() => setEngine("browser")}
                  className={`w-full py-3 px-4 rounded-xl text-xs font-bold transition-all duration-300 flex items-center justify-between gap-3 cursor-pointer border ${
                    engine === "browser"
                      ? "bg-amber-600 dark:bg-amber-700 text-white border-amber-500 shadow-md scale-[1.01]"
                      : "bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-850"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${engine === "browser" ? "bg-white animate-pulse" : "bg-amber-500"}`} />
                    <span>الهاتف الصوتي/المتصفح المحلي (أوفلاين 📱)</span>
                  </div>
                  {engine === "browser" && <span className="text-[10px] bg-amber-700 text-amber-100 px-2 py-0.5 rounded-full">نشط</span>}
                </button>
              </div>

              {/* AI Control Configuration and Multi-Keys Rotating Vault */}
              <div className="mt-4 border-t border-dashed border-gray-100 dark:border-slate-800/80 pt-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                {/* Diacritizer Switch */}
                <div className="flex items-center gap-3 bg-indigo-50/20 dark:bg-slate-900/40 p-3 rounded-2xl border border-indigo-100/30 dark:border-slate-800/80 flex-grow md:flex-1">
                  <Sparkles className="w-5 h-5 text-indigo-500 animate-pulse shrink-0" />
                  <div className="text-right flex-1">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">التحليل اللغوي والتشكيل التلقائي ذكياً 🧠</p>
                    <p className="text-[10px] text-gray-400 mt-0.5 leading-normal">يقوم الذكاء الاصطناعي بضبط حركات الإعراب بدقة لضمان النطق الفصيح.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer justify-end shrink-0 select-none mr-2">
                    <input 
                      type="checkbox" 
                      checked={useSmartAnalysis} 
                      onChange={(e) => setUseSmartAnalysis(e.target.checked)} 
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600" />
                  </label>
                </div>

                {/* API Rotation Button Trigger */}
                <button
                  type="button"
                  onClick={() => setShowKeysPanel(!showKeysPanel)}
                  className="flex items-center justify-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20 px-4 py-3.5 rounded-2xl border border-indigo-100/50 dark:border-indigo-950/40 hover:border-indigo-300 cursor-pointer transition-all duration-200 shrink-0"
                >
                  <Settings className={`w-4 h-4 ${showKeysPanel ? 'rotate-45' : ''} transition-transform duration-300`} />
                  <span>تنظيم وتدوير مفاتيح API الخاصة بك</span>
                  <span className="bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded-full font-mono font-bold leading-none">{customApiKeys.length}</span>
                </button>
              </div>

              {/* Collapsible Key Rotation Settings Panel */}
              <AnimatePresence>
                {showKeysPanel && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden bg-slate-50 dark:bg-slate-950/70 p-4 rounded-2xl border border-gray-150 dark:border-slate-800/85 space-y-3 mt-3 text-right"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">🔑</span>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">صندوق تدوير وتوفير مفاتيح Gemini API المجانية</h4>
                    </div>
                    <p className="text-[10px] leading-relaxed text-gray-400">
                      هل ترغب بنطق ممتاز وبلا حدود مجاناً؟ يمكنك استخراج مفاتيح API متعددة بلحظة وبكبسة زر واحدة من <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline font-bold">Google AI Studio</a> وإضافتها هنا. سيتولى الخادم تدويرها تلقائياً عند نفاذ حصة أي مفتاح، مما يمنحك عدداً لا نهائياً من المحاولات اليومية الفاخرة!
                    </p>

                    {/* Saved Keys Rows */}
                    {customApiKeys.length > 0 ? (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {customApiKeys.map((key, index) => (
                          <div key={index} className="flex items-center justify-between text-xs bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 px-3 py-2 rounded-xl">
                            <span className="font-mono text-gray-500 text-[10px] truncate max-w-[150px] md:max-w-md text-left">{key.slice(0, 15)}...{key.slice(-8)}</span>
                            <div className="flex items-center gap-2">
                              <span className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 text-[9px] px-2 py-0.5 rounded-full font-bold">نشط #{index + 1}</span>
                              <button
                                type="button"
                                onClick={() => saveCustomApiKeys(customApiKeys.filter((_, idx) => idx !== index))}
                                className="text-red-500 hover:text-red-700 text-[10px] font-bold duration-150 cursor-pointer hover:underline"
                              >
                                حذف المفتاح
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 bg-white dark:bg-slate-900/40 rounded-xl border border-dashed border-gray-100 dark:border-slate-800">
                        <p className="text-[10px] text-gray-400">لا توجد مفاتيح مضافة حتى الآن. سيتم استخدام المفتاح المجاني المدمج للموقع.</p>
                      </div>
                    )}

                    {/* Inputs for adding new Key */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="ألصق مفتاح ربط Gemini API هنا (مثال: AIzaSy...)"
                        value={newKeyInput}
                        onChange={(e) => setNewKeyInput(e.target.value)}
                        className="flex-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 px-3 py-2 rounded-xl text-xs font-mono focus:border-indigo-500 focus:outline-none text-left"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const trimmed = newKeyInput.trim();
                          if (trimmed) {
                            if (customApiKeys.includes(trimmed)) {
                              setError("هذا المفتاح مضاف مسبقاً بالفعل في صندوق التدوير.");
                              return;
                            }
                            saveCustomApiKeys([...customApiKeys, trimmed]);
                            setNewKeyInput("");
                            setError(null);
                          }
                        }}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 hover:shadow transition-all cursor-pointer shrink-0"
                      >
                        إضافة المفتاح ➕
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Custom Voice selector - Shared across TTS and Dubbing! */}
            <VoiceSelector
              selectedDialect={selectedDialect}
              setSelectedDialect={setSelectedDialect}
              selectedTone={selectedTone}
              setSelectedTone={setSelectedTone}
              selectedVoice={selectedVoice}
              setSelectedVoice={setSelectedVoice}
              selectedGender={selectedGender}
              setSelectedGender={setSelectedGender}
            />

            <hr className="border-gray-100 dark:border-slate-800" />

            {/* Conditional Sub-views rendering */}
            {activeTab === "tts" ? (
              <TtsForm
                text={text}
                setText={setText}
                isGenerating={isGenerating}
                onSubmit={handleSubmitTts}
                dialectLabel={getDialectLabel()}
                toneLabel={getToneLabel()}
              />
            ) : (
              /* Multimodal Video/Audio Dubbing Form (V-Dub AI Studio) */
              <div className="space-y-6 text-right">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                  <Video className="w-5 h-5" />
                  <h3 className="text-sm font-bold">واجهة الدبلجة والترجمة الصوتية للمرئيات والمسموعات 🎙️</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  ارفع مقاطع فيديو (مثل أفلام كرتون، لقطات، مواد تعليمة) أو صوتيات بأي لغة كانت (إنكليزية، تركية، أو غيرها). سيقوم الذكاء الاصطناعي بنقل كلام الفيديو وترجمته ترجمة فنانين درامية وربطه بجودة فائقة مع الأصوات والنبرات المختارة بالأعلى وتوفيره فورا!
                </p>

                {/* Upload Section */}
                <div className="border-2 border-dashed border-gray-250 dark:border-slate-800 rounded-3xl p-6 hover:border-indigo-400 transition-colors bg-slate-50/50 dark:bg-slate-900/40 text-center relative">
                  <input
                    type="file"
                    accept="video/*,audio/*"
                    onChange={handleDubFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
                    <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-500">
                      <Upload className="w-6 h-6 animate-bounce" />
                    </div>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-350">
                      {dubFileName ? `الملف المحدد: ${dubFileName}` : "انقر أو اسحب ملف ميديا لرفعه ودبلجته"}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      ندعم صيغ الفيديو والصوت المتنوعة (MP4, WebM, MP3, WAV) لغاية 25 ميجابايت كحد أقصى.
                    </p>
                  </div>
                </div>

                {/* User Selected Media Preview */}
                {dubFile && (
                  <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-gray-150 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono text-gray-400 dark:text-gray-500">حجم الملف: {(dubFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 justify-end">
                        <FileAudio className="w-4 h-4 text-indigo-500" />
                        معاينة المقطع المرفوع مباشرة:
                      </h4>
                    </div>

                    {dubFileMimeType?.startsWith("video/") ? (
                      <video
                        ref={el => { dubOriginalMediaRef.current = el; }}
                        src={dubFileUrl || undefined}
                        muted={isOriginalAudioMuted}
                        controls={false}
                        className="w-full max-h-64 object-contain rounded-xl border border-gray-200 dark:border-slate-800 bg-black pointer-events-none"
                      />
                    ) : (
                      <audio
                        ref={el => { dubOriginalMediaRef.current = el; }}
                        src={dubFileUrl || undefined}
                        controls={false}
                        muted={isOriginalAudioMuted}
                        className="w-full pointer-events-none h-12"
                      />
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-dashed border-gray-200/50 dark:border-slate-800/80">
                      <span className="text-[10px] text-gray-450">مثالي للمقارنة والتحقق من انسجام الدبلجة</span>
                      <button
                        type="button"
                        onClick={() => setIsOriginalAudioMuted(!isOriginalAudioMuted)}
                        className={`text-[11px] font-bold px-3 py-1 rounded-full cursor-pointer transition-colors ${
                          isOriginalAudioMuted 
                            ? "bg-red-500 text-white hover:bg-red-650"
                            : "bg-gray-150 dark:bg-slate-800 text-slate-700 dark:text-slate-350 hover:bg-gray-200"
                        }`}
                      >
                        {isOriginalAudioMuted ? "🔈 إلغاء كتم الفيديو الأصلي" : "🔇 كتم صوت الفيديو الأصلي"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Dub Action Trigger */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleStartDubbing}
                    disabled={isDubbing || !dubFile}
                    className={`w-full py-4 px-6 rounded-2xl font-bold text-sm tracking-wide shadow-md transition-all flex items-center justify-center gap-3 cursor-pointer ${
                      isDubbing || !dubFile
                        ? "bg-slate-200 dark:bg-slate-850 text-slate-400 cursor-not-allowed"
                        : "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white hover:shadow-lg hover:from-indigo-700 hover:to-indigo-800 transform hover:-translate-y-0.5"
                    }`}
                  >
                    {isDubbing ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        <span>يجري غسيل الصوت، الترجمة والدبلجة العاطفية للفيلم... (يرجى الانتظار ⏳)</span>
                      </>
                    ) : (
                      <>
                        <Video className="w-5 h-5" />
                        <span>ابدأ دبلجة المقطع وترجمته فورياً بالعربي 🎥⚡</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Dubbing Results Showcase */}
                <AnimatePresence>
                  {dubbingResult && (
                    <motion.div
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-indigo-50/10 dark:bg-slate-900/30 p-5 rounded-3xl border border-indigo-150/50 dark:border-indigo-900/40 space-y-6 text-right mt-6"
                    >
                      {/* Section Head */}
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-indigo-100/30 dark:border-slate-800/80 pb-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">نتائج الاستديو والتمثيل الصوتي:</h4>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="bg-indigo-100 dark:bg-indigo-950 text-indigo-750 dark:text-indigo-400 px-3 py-1 rounded-full font-bold">
                            اللغة المكتشفة: {dubbingResult.originalLanguage || "إنجليزية / غيرها"}
                          </span>
                          <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-350 px-2.5 py-1 rounded-full font-bold">
                            الحديث: {dubbingResult.hasSpeech ? "نعم 🗣️" : "نصوص ومؤشرات مكتوبة 📖"}
                          </span>
                        </div>
                      </div>

                      {/* Scene Mood Visualized */}
                      {dubbingResult.scenesSummary && (
                        <div className="bg-zinc-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-zinc-150 dark:border-slate-850/80">
                          <h5 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">وصف الذكاء الاصطناعي للمشاهد وأحداث المقطع:</h5>
                          <p className="text-xs text-slate-700 dark:text-slate-250 leading-relaxed font-sans mt-0.5">{dubbingResult.scenesSummary}</p>
                        </div>
                      )}

                      {/* Dubbed Audio playback interface */}
                      <div className="bg-indigo-950 text-white p-5 rounded-2xl border border-indigo-900 space-y-4 shadow-xl">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-indigo-300 font-bold animate-pulse">● استديو الدبلجة نشط</span>
                          <span className="text-xs font-bold text-indigo-200">صوت الدبلجة المحاكي المكتمل 🎙️</span>
                        </div>

                        {/* Native play elements & indicators */}
                        <audio
                          ref={dubAudioRef}
                          src={dubAudioUrl || undefined}
                          onPlay={() => setDubPlayState("playing")}
                          onPause={() => setDubPlayState("paused")}
                          onEnded={() => setDubPlayState("stopped")}
                          className="hidden"
                        />

                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={toggleDubAudioPlay}
                              className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-indigo-600 flex items-center justify-center text-white shadow hover:scale-105 transition-transform cursor-pointer"
                            >
                              {dubPlayState === "playing" ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 stroke-[3] translate-x-[-1px]" />}
                            </button>
                            <div className="text-right">
                              <p className="text-xs font-bold">استماع للدبلجة بلهجة: {getDialectLabel()}</p>
                              <p className="text-[10px] text-indigo-300 mt-0.5">النبرة الفنية: {getToneLabel()} | الميكروفون: {selectedVoice}</p>
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row items-center gap-3">
                            <a
                              href={dubAudioUrl || undefined}
                              download={`dubbed_arabic_${selectedDialect}.wav`}
                              className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 text-xs rounded-xl font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Download className="w-4 h-4" />
                              <span>تحميل الصوت المدبلج WAV</span>
                            </a>
                          </div>
                        </div>

                        {/* Video Merge Options when a Video is loaded */}
                        {dubFileMimeType?.startsWith("video/") && (
                          <div className="mt-4 pt-4 border-t border-indigo-900/60">
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                              <div className="text-right">
                                <p className="text-xs font-bold text-indigo-100 flex items-center gap-1 justify-end sm:justify-start">
                                  <span>تصدير ودمج الفيديو الجديد المكتمل 🎬 ✨</span>
                                </p>
                                <p className="text-[10px] text-indigo-300 mt-1">يجرى دمج دقيق لفيلم الفيديو الأصلي بالكامل مع الصوت المدبلج بلهجة {getDialectLabel()}</p>
                              </div>
                              
                              <button
                                type="button"
                                onClick={handleMergeAndDownloadVideo}
                                disabled={isMergingVideo}
                                className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                                  isMergingVideo 
                                    ? "bg-indigo-900/40 border border-indigo-750 text-indigo-300 cursor-not-allowed" 
                                    : "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-md hover:shadow-lg hover:scale-103 cursor-pointer"
                                }`}
                                dir="rtl"
                              >
                                {isMergingVideo ? (
                                  <>
                                    <span className="w-4 h-4 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin"></span>
                                    <span>يتم الدمج والتنزيل ({mergingProgress}%)</span>
                                  </>
                                ) : (
                                  <>
                                    <Video className="w-4 h-4" />
                                    <span>دمج وتصدير الفيديو المدبلج فوراً 🚀</span>
                                  </>
                                )}
                              </button>
                            </div>

                            {/* Live video compilation progress drawer */}
                            {isMergingVideo && (
                              <div className="mt-4 p-4 bg-slate-900/60 dark:bg-black/40 rounded-3xl border border-indigo-500/35 flex flex-col items-center justify-center gap-3">
                                <p className="text-[11px] font-bold text-indigo-300 flex items-center gap-1.5 justify-center">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                  <span>شاشة معالجة ومزامنة الإطارات المباشرة (يرجى عدم إغلاق هذه الصفحة) 🎞️:</span>
                                </p>
                                <div id="video-recording-display-target" className="w-[200px] h-[112px] bg-black rounded-xl border border-indigo-400/45 relative overflow-hidden flex items-center justify-center shadow-md select-none">
                                  <span className="absolute z-10 text-[9px] bg-indigo-950/95 border border-indigo-500/50 text-indigo-200 font-mono px-1.5 py-0.5 rounded bottom-2 left-2 font-bold tracking-tight animate-pulse" style={{ direction: "ltr" }}>
                                    LIVE RE-STREAMING
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Side-by-side Dubbing Scripts */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Arabic script Column */}
                        <div className="bg-white dark:bg-slate-900 border border-indigo-100 dark:border-slate-800/80 p-4 rounded-2xl text-right flex flex-col">
                          <h5 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 justify-end mb-2">
                            <span>السيناريو المدبلج بالعربية (قابل للتعديل)</span>
                            <span className="text-[10px]">📖</span>
                          </h5>
                          <textarea
                            value={editedScript !== "" ? editedScript : dubbingResult.arabicTranslation}
                            onChange={(e) => setEditedScript(e.target.value)}
                            className="text-xs leading-relaxed text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl min-h-[120px] max-h-48 overflow-y-auto font-sans w-full border border-gray-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none flex-grow"
                            dir="rtl"
                          />
                          <button
                            type="button"
                            onClick={() => handleStartDubbing(editedScript !== "" ? editedScript : dubbingResult.arabicTranslation)}
                            disabled={isDubbing}
                            className={`mt-3 w-full py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                              isDubbing
                                ? "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                                : "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/60"
                            }`}
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isDubbing ? "animate-spin" : ""}`} />
                            <span>تحديث ودبلجة السيناريو المعدل 🔄</span>
                          </button>
                        </div>

                        {/* Foreign Transcription Column */}
                        <div className="bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800/80 p-4 rounded-2xl text-right">
                          <h5 className="text-xs font-bold text-gray-500 flex items-center gap-1 justify-end mb-2">
                            <span>النص والتغريغ اللغوي الأصلي (Transcription)</span>
                            <span className="text-[10px]">💬</span>
                          </h5>
                          <div className="text-xs leading-relaxed text-slate-500 dark:text-gray-400 bg-slate-50/50 dark:bg-slate-950/60 p-3 rounded-xl max-h-48 overflow-y-auto font-sans text-left" dir="ltr">
                            {dubbingResult.transcription}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </section>

          {/* Right column - Main Player & Saved Audios (5 cols) */}
          <section className="lg:col-span-12 xl:col-span-4 space-y-6 w-full">
          {/* Active play widgets */}
          <AnimatePresence mode="wait">
            {playingItem ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl border border-slate-800 space-y-4"
                id="active-player-widget"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping" />
                    <span className="text-xs font-semibold text-indigo-400">يجري الاستماع الآن...</span>
                  </div>
                  <button
                    onClick={stopPcm}
                    type="button"
                    className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>إيقاف التشغيل</span>
                  </button>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-slate-400 line-clamp-1">النص المقروء:</p>
                  <p className="text-sm font-medium text-slate-200 leading-relaxed font-sans block truncate text-right">
                    {playingItem.text}
                  </p>
                </div>

                {/* Animated Waveform indicator */}
                <div className="flex items-center justify-center gap-1 h-8 py-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 8, 6, 4, 2, 5, 8, 10, 7].map((val, i) => (
                    <motion.div
                      key={i}
                      animate={{
                        height: playState === "playing" ? [6, val * 3, 6] : 6,
                      }}
                      transition={{
                        repeat: Infinity,
                        duration: 0.6 + i * 0.05,
                        ease: "easeInOut",
                      }}
                      className="w-1.5 rounded-full bg-gradient-to-t from-indigo-500 to-sky-400"
                    />
                  ))}
                </div>

                {/* Speed controllers & triggers */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-400">سرعة الإلقاء:</span>
                    {[0.75, 1.0, 1.25, 1.5].map((speed) => (
                      <button
                        key={speed}
                        onClick={() => changeSpeed(speed)}
                        type="button"
                        className={`text-xs px-2 py-1 rounded-lg font-mono font-semibold transition-all cursor-pointer ${
                          playbackSpeed === speed
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => handleDownload(playingItem)}
                    type="button"
                    className="p-2 sm:px-3 sm:py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs flex items-center gap-1 cursor-pointer transition-colors"
                    title="تحميل الملف الصوتي الكلي بصيغة WAV"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">تحميل WAV</span>
                  </button>
                </div>
              </motion.div>
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-6 text-center space-y-3" id="player-idle-widget">
                <Volume2 className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
                <h4 className="text-xs font-bold text-slate-400 pr-1">بث واستماع مباشر</h4>
                <p className="text-[11px] text-gray-400 max-w-xs mx-auto">
                  قم بكتابة النص والنقر على زر توليد الصوت وسيتم تشغيله مباشرة في هذا المكان مع خيارات للتحكم في السرعة والتحميل.
                </p>
              </div>
            )}
          </AnimatePresence>

          {/* Feedback panels */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-rose-50 border border-rose-100 dark:bg-rose-950/20 dark:border-rose-950/40 p-4 rounded-2xl flex items-start gap-3"
                id="error-msg-box"
              >
                <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5" />
                <div className="text-right space-y-1">
                  <h4 className="text-xs font-bold text-rose-900 dark:text-rose-400">تنبيه لغوي / تقني</h4>
                  <p className="text-[11px] text-rose-700 dark:text-rose-300 leading-normal">{error}</p>
                </div>
              </motion.div>
            )}

            {successMsg && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-emerald-50 border border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-950/40 p-4 rounded-2xl flex items-start gap-3"
                id="success-msg-box"
              >
                <Volume2 className="w-5 h-5 text-emerald-600 mt-0.5" />
                <div className="text-right space-y-1">
                  <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-400">نطق سليم وصوت مسموع</h4>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300">{successMsg}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Saved elements widget */}
          <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
            <AudioHistory
              history={history}
              currentlyPlayingId={currentlyPlayingId}
              onPlay={playPcm}
              onPause={stopPcm}
              onDownload={handleDownload}
              onDelete={handleDeleteHistoryItem}
              onClearAll={handleClearAllHistory}
            />
          </div>

          {/* Prompt guidance */}
          <div className="bg-indigo-50/20 dark:bg-slate-900/40 border border-indigo-100/30 dark:border-slate-800 rounded-3xl p-5 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-indigo-500" />
              كيف مكننا توليد نبرة صوت تعبيرية؟
            </h4>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed text-right">
              بما أننا نستخدم الطراز المتقدم <b>Gemini 3.1 tts</b>، فإننا نقوم بتمرير توجيهات انفعالية ذكية ومفصلة في الخلفية مع النص المعالج. هذا يجعل محرك النطق يبث النعومة والمرح أو القوة والحدة مباشرة بناءً على السياق الانفعالي الذي اخترته بلغة حياكة فريدة!
            </p>
          </div>
        </section>
      </div>
      </main>

      <footer className="bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 py-6 mt-12 text-center text-xs text-gray-500 dark:text-gray-400">
        <div className="max-w-7xl mx-auto px-4 space-y-2">
          <p className="font-semibold text-slate-800 dark:text-slate-200">
            تطبيق تحويل النص إلى صوت ذكي © {new Date().getFullYear()} جميع الحقوق محفوظة.
          </p>
          <p className="text-[11px] leading-relaxed">
            مُعزَّز بأصوات ومحاكاة انفعالية عربية ذكية ومحسّن للنصوص الصعبة ومخارج الحروف.
          </p>
        </div>
      </footer>
    </div>
  );
}
