import React, { useState, useEffect, useRef } from "react";
import { Bookmark, Folder, HotkeyConfig, VideoMetadata, DEFAULT_HOTKEYS } from "./types";
import { WaveformTimeline } from "./components/WaveformTimeline";
import { HotkeySettings } from "./components/HotkeySettings";
import { BookmarkManager } from "./components/BookmarkManager";
import { 
  Play, Pause, RotateCw, SkipBack, SkipForward, Flame, Keyboard, Info, Check, AlertCircle,
  HelpCircle, Sparkles, Sliders, Volume2, Globe, Music, GraduationCap, Monitor
} from "lucide-react";

// Standard YouTube URL extractor
function extractVideoId(urlOrId: string): string {
  const trimmed = urlOrId.trim();
  if (!trimmed) return "";
  if (trimmed.length === 11) return trimmed; // Direct ID
  
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
  const match = trimmed.match(regExp);
  return (match && match[2].length === 11) ? match[2] : trimmed;
}

// Preset playground clips for instant loading
const PRESET_VIDEOS = [
  {
    id: "H6J_RZZqG9E",
    title: "구동사 극복하기! 꼭 알아야 할 패턴 상황별 핵심 학습",
    channel: "잉글리시 쉐도잉 클래스",
    duration: 365,
    tag: "영어 회화",
    icon: GraduationCap,
  },
  {
    id: "gG9Ssh98XG8",
    title: "클래식 어쿠스틱 대표 핑거스타일 기타 마스터 코스",
    channel: "기타 핑거스튜디",
    duration: 180,
    tag: "기타 연습",
    icon: Music,
  },
  {
    id: "87_k60_A84I",
    title: "Lo-fi 저녁 공부&코딩 집중 배경음악 리듬 루프",
    channel: "로파이 오르골",
    duration: 480,
    tag: "포커스 뮤직",
    icon: Sparkles,
  }
];

export default function App() {
  // --- Persistent Storage State ---
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => {
    const saved = localStorage.getItem("yt_loop_bookmarks");
    return saved ? JSON.parse(saved) : [];
  });

  const [folders, setFolders] = useState<Folder[]>(() => {
    const saved = localStorage.getItem("yt_loop_folders");
    if (saved) return JSON.parse(saved);
    // Setup sensible defaults
    return [
      { id: "fold-1", name: "영어 회화 쉐도잉", color: "Cyan" },
      { id: "fold-2", name: "악기 연주 카피", color: "Emerald" },
      { id: "fold-3", name: "즐겨찾기 보컬 연습", color: "Rose" },
    ];
  });

  const [hotkeys, setHotkeys] = useState<HotkeyConfig>(() => {
    const saved = localStorage.getItem("yt_loop_hotkeys");
    return saved ? JSON.parse(saved) : DEFAULT_HOTKEYS;
  });

  // --- Dynamic Player State ---
  const [videoIdInput, setVideoIdInput] = useState("");
  const [activeVideoId, setActiveVideoId] = useState("");
  const [videoMeta, setVideoMeta] = useState<VideoMetadata>({
    videoId: "",
    title: "구간 반복을 진행할 유튜브 영상을 불러와 주세요",
    channelTitle: "학습 동영상 대기 중 📺",
    thumbnail: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='90' viewBox='0 0 120 90'><rect width='120' height='90' fill='%231e293b'/></svg>",
    duration: 300,
    loading: false
  });

  // Loop settings
  const [loopActive, setLoopActive] = useState(true);
  const [startTime, setStartTime] = useState(10);
  const [endTime, setEndTime] = useState(40);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Advanced repeating configurations
  const [cooldownDelay, setCooldownDelay] = useState<number>(0); // 0, 1, 2, 3 seconds cooldown
  const [countdownIntro, setCountdownIntro] = useState<boolean>(true); // beep before restarting
  const [isCooldownActive, setIsCooldownActive] = useState(false);
  const [cooldownTimer, setCooldownTimer] = useState(0);

  // --- UI Notification feedback ---
  const [hotkeyNotification, setHotkeyNotification] = useState<{ text: string; id: number } | null>(null);
  const [showConfigHotkeys, setShowConfigHotkeys] = useState(false);

  // Player and loop reference controls
  const playerRef = useRef<any>(null);
  const iframeReadyRef = useRef<boolean>(false);
  const loopIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cooldownTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const feedbackTimeoutRef = useRef<number | null>(null);

  // --- Popout Mode Management for Second Monitor Fullscreen ---
  const popoutWindowRef = useRef<Window | null>(null);
  const [popoutActive, setPopoutActive] = useState(false);
  const [playerSize, setPlayerSize] = useState<number>(100); // Main video player size percent (50% to 100%)
  const [isPlayerReady, setIsPlayerReady] = useState(false);

  // Listen for real-time playhead/status feedbacks from Popout Sub-window
  useEffect(() => {
    const handlePopoutMessage = (e: MessageEvent) => {
      if (!e.data || typeof e.data !== "object") return;
      
      const { action } = e.data;
      if (action === "popout_time_update") {
        if (popoutActive) {
          const remoteTime = parseFloat(e.data.currentTime);
          if (!isNaN(remoteTime)) {
            setCurrentTime(remoteTime);
          }
          if (typeof e.data.isPlaying === "boolean") {
            setIsPlaying(e.data.isPlaying);
          }
        }
      } else if (action === "popout_closed") {
        setPopoutActive(false);
      }
    };

    window.addEventListener("message", handlePopoutMessage);
    return () => {
      window.removeEventListener("message", handlePopoutMessage);
    };
  }, [popoutActive]);

  const syncPopoutWithParent = (action: string, data: any = {}) => {
    if (popoutWindowRef.current && !popoutWindowRef.current.closed) {
      popoutWindowRef.current.postMessage({ action, ...data }, "*");
    }
    localStorage.setItem("yt_loop_sync", JSON.stringify({
      action,
      data,
      timestamp: Date.now()
    }));
  };

  const openPopoutMode = () => {
    if (popoutWindowRef.current && !popoutWindowRef.current.closed) {
      popoutWindowRef.current.focus();
      showTemporaryNotification("이미 보조 플레이어 창이 열려 있습니다 📺");
      return;
    }

    const popoutUrl = `${window.location.origin}${window.location.pathname}?popout=true&videoId=${encodeURIComponent(activeVideoId)}&startTime=${startTime}&endTime=${endTime}&speed=${playbackSpeed}`;
    const win = window.open(
      popoutUrl,
      "YTubeRepeatPopoutWindow",
      "width=1024,height=576,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=no"
    );

    if (win) {
      popoutWindowRef.current = win;
      setPopoutActive(true);
      showTemporaryNotification("보조 모니터 팝아웃 창이 활성화되었습니다 📺");

      const timer = setInterval(() => {
        if (win.closed) {
          clearInterval(timer);
          setPopoutActive(false);
          popoutWindowRef.current = null;
        }
      }, 1050);
    } else {
      alert("팝업창이 브라우저에 의해 차단되었습니다. 브라우저 설정에서 이 사이트의 팝업 허용을 활성화해주세요!");
    }
  };

  const togglePopoutMode = () => {
    if (popoutActive || (popoutWindowRef.current && !popoutWindowRef.current.closed)) {
      if (popoutWindowRef.current) {
        popoutWindowRef.current.close();
      }
      setPopoutActive(false);
      popoutWindowRef.current = null;
      showTemporaryNotification("보조 모니터 전송을 껐습니다. 창이 닫힙니다 ❌");
    } else {
      openPopoutMode();
    }
  };

  const handleSeekToTime = (dest: number) => {
    if (playerRef.current) {
      playerRef.current.seekTo(dest, true);
      if (popoutActive) {
        try {
          playerRef.current.pauseVideo();
        } catch (e) {}
      }
    }
    setCurrentTime(dest);
    syncPopoutWithParent("seek", { currentTime: dest });
  };

  // Auto-sync status to Popout on state changes
  useEffect(() => {
    syncPopoutWithParent("sync_state", {
      videoId: activeVideoId,
      startTime,
      endTime,
      loopActive,
      playbackSpeed,
      isPlaying,
      currentTime
    });
  }, [activeVideoId, startTime, endTime, loopActive, playbackSpeed, isPlaying]);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem("yt_loop_bookmarks", JSON.stringify(bookmarks));
  }, [bookmarks]);

  useEffect(() => {
    localStorage.setItem("yt_loop_folders", JSON.stringify(folders));
  }, [folders]);

  useEffect(() => {
    localStorage.setItem("yt_loop_hotkeys", JSON.stringify(hotkeys));
  }, [hotkeys]);

  // Handle YouTube video API meta search secure proxy
  useEffect(() => {
    if (!activeVideoId) return;

    const fetchMeta = async () => {
      setVideoMeta(prev => ({ ...prev, loading: true, error: "" }));
      try {
        const res = await fetch(`/api/youtube-meta?videoId=${encodeURIComponent(activeVideoId)}`);
        if (!res.ok) throw new Error("Metadata API resolution failed");
        const data = await res.json();
        
        setVideoMeta({
          videoId: activeVideoId,
          title: data.title || "YouTube Video",
          channelTitle: data.channelTitle || "YouTube Channel",
          thumbnail: data.thumbnail || `https://img.youtube.com/vi/${activeVideoId}/hqdefault.jpg`,
          duration: data.duration || 300,
          loading: false
        });

        // Initialize markers
        setStartTime(0);
        setEndTime(data.duration || 300);
      } catch (err: any) {
        console.warn("Could not fetch video meta securely:", err.message);
        // Fallback gracefully using live iframe metrics later
        setVideoMeta({
          videoId: activeVideoId,
          title: "YouTube Video Resource",
          channelTitle: "Media Node",
          thumbnail: `https://img.youtube.com/vi/${activeVideoId}/hqdefault.jpg`,
          duration: 300,
          loading: false,
          error: "API Key Metadata fallback"
        });
        setStartTime(0);
        setEndTime(300);
      }
    };

    fetchMeta();
  }, [activeVideoId]);

  // Synchronize dynamic loops with audio playhead
  useEffect(() => {
    if (loopIntervalRef.current) {
      clearInterval(loopIntervalRef.current);
    }

    loopIntervalRef.current = setInterval(() => {
      if (!playerRef.current || isCooldownActive) return;

      try {
        if (popoutActive) {
          // 팝업 활성화 시 메인 비디오는 절대 작동하지 않고 pause 강제 유지
          try {
            if (typeof playerRef.current.getPlayerState === "function" && playerRef.current.getPlayerState() === 1) {
              playerRef.current.pauseVideo();
            }
          } catch (e) {}
          return; // 메인 타이머 폴러는 중지하고 팝업 메세지를 수신 대기함
        }

        // Grab precise timestamp directly from Youtube player Iframe API
        const time = playerRef.current.getCurrentTime();
        if (typeof time === "number" && !isNaN(time)) {
          setCurrentTime(time);

          // Loop repeat check bounding
          if (loopActive && time >= endTime) {
            handleRepeatReset();
          }
        }
      } catch (err) {
        // Player state is unavailable/initializing
      }
    }, 150);

    return () => {
      if (loopIntervalRef.current) clearInterval(loopIntervalRef.current);
    };
  }, [startTime, endTime, loopActive, isCooldownActive, cooldownDelay, countdownIntro, popoutActive]);

  // Web Audio synth chime to guide intervals nicely
  const playCountdownSynthTone = (freq: number, dur: number) => {
    if (!countdownIntro) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
      osc.start();
      osc.stop(audioCtx.currentTime + dur);
    } catch (e) {
      // Ignored if user has not interacted with DOM first
    }
  };

  // Restarts playback loop with optional cooldown pauses and countdowns
  const handleRepeatReset = () => {
    if (!playerRef.current) return;

    if (cooldownDelay > 0) {
      // Pause active playback
      playerRef.current.pauseVideo();
      setIsPlaying(false);
      setIsCooldownActive(true);
      setCooldownTimer(cooldownDelay);

      // Cue back to A first so visual frame updates
      playerRef.current.seekTo(startTime, true);
      setCurrentTime(startTime);

      // Play introductory warning tick right away
      playCountdownSynthTone(800, 0.08);

      // Recursive tick counter
      let ticksLeft = cooldownDelay;
      const interval = setInterval(() => {
        ticksLeft -= 1;
        setCooldownTimer(ticksLeft);
        if (ticksLeft > 0) {
          playCountdownSynthTone(800, 0.08);
        } else {
          clearInterval(interval);
          playCountdownSynthTone(1200, 0.18); // Final bright tone
          setIsCooldownActive(false);
          playerRef.current.playVideo();
          setIsPlaying(true);
        }
      }, 1000);

    } else {
      // Reset instantly
      playerRef.current.seekTo(startTime, true);
      setCurrentTime(startTime);
    }
  };

  // Load YouTube Player Script and register listeners
  useEffect(() => {
    if (!activeVideoId) {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {}
        playerRef.current = null;
      }
      iframeReadyRef.current = false;
      setIsPlayerReady(false);
      return;
    }

    setIsPlayerReady(false);

    // If global variable not present, initialize it
    if (!(window as any).onYouTubeIframeAPIReady) {
      (window as any).onYouTubeIframeAPIReady = () => {
        initYoutubePlayerToDom();
      };
    }

    const scriptLoaded = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!scriptLoaded) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
    } else if ((window as any).YT && (window as any).YT.Player) {
      initYoutubePlayerToDom();
    }

    return () => {
      // Clean up player before remount
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {}
        playerRef.current = null;
      }
    };
  }, [activeVideoId]);

  const initYoutubePlayerToDom = () => {
    if (!(window as any).YT || !activeVideoId) return;
    
    playerRef.current = new (window as any).YT.Player("youtube-player-frame", {
      videoId: activeVideoId,
      playerVars: {
        autoplay: 1,
        controls: 1, // enabling default overlay simplifies scrubbers
        rel: 0,
        modestbranding: 1,
        playsinline: 1,
      },
      events: {
        onReady: (event: any) => {
          iframeReadyRef.current = true;
          setIsPlayerReady(true);
          // Synchronize continuous speed
          event.target.setPlaybackRate(playbackSpeed);
          
          // Double check actual real video duration to update fallback meta
          const duration = event.target.getDuration();
          if (duration && duration > 0) {
            setVideoMeta(prev => ({ ...prev, duration }));
            setEndTime(duration);
          }

          // 영상을 플레이하여 즉각적인 상태로 만든 전, 곧장 정지하여 즉시 대기 반응 상태로 진입하게 함
          event.target.playVideo();
          setTimeout(() => {
            try {
              if (playerRef.current && typeof playerRef.current.pauseVideo === "function") {
                playerRef.current.pauseVideo();
              }
            } catch (e) {}
            setIsPlaying(false);
          }, 350);
        },
        onStateChange: (event: any) => {
          // YT.PlayerState.PLAYING = 1, PAUSED = 2
          if (event.data === 1) {
            if (popoutActive) {
              // 듀얼모니터 전송 중에는 메인 영상이 플레이되는 것을 방지합니다.
              try {
                event.target.pauseVideo();
              } catch (e) {}
              setIsPlaying(true); // 버튼 UI 상태만 플레이 상태로 표시 유지 (오직 팝업만 움직이게 함)
            } else {
              setIsPlaying(true);
            }
          } else {
            if (!popoutActive) {
              setIsPlaying(false);
            }
          }
        },
        onError: (event: any) => {
          console.warn("YouTube player integration error code:", event.data);
          setIsPlayerReady(true); // dismiss overlay so fallback messages/controls can be seen
        }
      }
    });
  };

  // Fast trigger video load
  const loadNewVideo = (id: string) => {
    const freshId = extractVideoId(id);
    if (!freshId || freshId.length !== 11) {
      showTemporaryNotification("올바른 유튜브 링크 또는 ID를 작성해주세요 ⚠️");
      return;
    }
    setActiveVideoId(freshId);
    setVideoIdInput("");
    showTemporaryNotification("유튜브 동영상이 로드되었습니다 ✨");
  };

  // Speed handler adjustments
  const changeSpeedFactor = (factor: number) => {
    const clamped = Math.max(0.25, Math.min(2.0, factor));
    setPlaybackSpeed(clamped);
    if (playerRef.current && iframeReadyRef.current) {
      playerRef.current.setPlaybackRate(clamped);
    }
    showTemporaryNotification(`배속 속도 조절 완료: ${clamped.toFixed(2)}x`);
  };

  // Player Play/Pause toggles
  const handleTogglePlay = () => {
    if (!playerRef.current) return;
    if (popoutActive) {
      // 듀얼모니터 전송 상태일 때는 메인 동영상은 항상 pause 상태를 고수하며 작동하지 않도록 제어합니다.
      try {
        playerRef.current.pauseVideo();
      } catch (e) {}
      
      const nextPlayState = !isPlaying;
      setIsPlaying(nextPlayState);
      
      showTemporaryNotification(`[보조 모니터 전송] ${nextPlayState ? "재생" : "일시정지"} 명령 전달 📺`);
      return;
    }

    if (isPlaying) {
      playerRef.current.pauseVideo();
      setIsPlaying(false);
    } else {
      playerRef.current.playVideo();
      setIsPlaying(true);
    }
  };

  // Seeks player relative to current playhead
  const handleSeekRelative = (seconds: number) => {
    if (!playerRef.current) return;
    const time = playerRef.current.getCurrentTime() || 0;
    const dest = Math.max(0, Math.min(time + seconds, videoMeta.duration));
    handleSeekToTime(dest);
    showTemporaryNotification(`${seconds > 0 ? "앞으로" : "뒤로"} ${Math.abs(seconds)}초 탐색`);
  };

  // Jump exact 1 frame back or forward
  const handleFrameSeek = (forward: boolean) => {
    if (!playerRef.current) return;
    const fps = 30; // standard approx
    const step = 1 / fps; // 0.033 seconds
    const time = playerRef.current.getCurrentTime() || 0;
    const dest = forward 
      ? Math.min(time + step, videoMeta.duration)
      : Math.max(0, time - step);
    
    handleSeekToTime(dest);
    showTemporaryNotification(forward ? "1 프레임 앞으로 (미세제어)" : "1 프레임 뒤로 (미세제어)");
  };

  // Hotkey notification bubble helper
  const showTemporaryNotification = (text: string) => {
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }
    const id = Date.now();
    setHotkeyNotification({ text, id });
    feedbackTimeoutRef.current = window.setTimeout(() => {
      setHotkeyNotification(null);
    }, 2200);
  };

  // --- Keyboard Hotkeys Global Input Listener ---
  useEffect(() => {
    const handleKeyDownGlobally = (e: KeyboardEvent) => {
      // Skip listening inside input text boxes, select tags, or text areas
      const isTyping = e.target instanceof HTMLInputElement || 
                       e.target instanceof HTMLTextAreaElement || 
                       e.target instanceof HTMLSelectElement;
      if (isTyping) return;

      const key = e.key;

      // Matches custom assignments
      if (key === hotkeys.playPause) {
        e.preventDefault();
        handleTogglePlay();
      } else if (key === hotkeys.setStart) {
        e.preventDefault();
        const current = playerRef.current ? playerRef.current.getCurrentTime() : currentTime;
        setStartTime(Math.max(0, Math.min(current, endTime - 0.2)));
        showTemporaryNotification(`구간 시작점 (A) 지정 완료: ${formatTimeAsSeconds(current)} 📍`);
      } else if (key === hotkeys.setEnd) {
        e.preventDefault();
        const current = playerRef.current ? playerRef.current.getCurrentTime() : currentTime;
        setEndTime(Math.max(startTime + 0.2, Math.min(current, videoMeta.duration)));
        showTemporaryNotification(`구간 끝나는점 (B) 지정 완료: ${formatTimeAsSeconds(current)} 📍`);
      } else if (key === hotkeys.loopToggle) {
        e.preventDefault();
        setLoopActive(!loopActive);
        showTemporaryNotification(`구간 반복 재생: ${!loopActive ? "활성화" : "비활성화"}`);
      } else if (key === hotkeys.speedDown) {
        e.preventDefault();
        changeSpeedFactor(playbackSpeed - 0.1);
      } else if (key === hotkeys.speedUp) {
        e.preventDefault();
        changeSpeedFactor(playbackSpeed + 0.1);
      } else if (key === hotkeys.rewind10) {
        e.preventDefault();
        handleSeekRelative(-10);
      } else if (key === hotkeys.forward10) {
        e.preventDefault();
        handleSeekRelative(10);
      } else if (key === hotkeys.frameBack) {
        e.preventDefault();
        handleFrameSeek(false);
      } else if (key === hotkeys.frameForward) {
        e.preventDefault();
        handleFrameSeek(true);
      } else if (key === hotkeys.captureStart) {
        e.preventDefault();
        const current = playerRef.current ? playerRef.current.getCurrentTime() : currentTime;
        setStartTime(current);
        showTemporaryNotification(`원터치 시작캡처 [S] 성공: ${formatTimeAsSeconds(current)} (여기!)`);
      } else if (key === hotkeys.captureEnd) {
        e.preventDefault();
        const current = playerRef.current ? playerRef.current.getCurrentTime() : currentTime;
        setEndTime(current);
        showTemporaryNotification(`원터치 종료캡처 [E] 성공: ${formatTimeAsSeconds(current)} (여기!)`);
      }
    };

    window.addEventListener("keydown", handleKeyDownGlobally);
    return () => {
      window.removeEventListener("keydown", handleKeyDownGlobally);
    };
  }, [hotkeys, isPlaying, startTime, endTime, playbackSpeed, loopActive, currentTime, videoMeta.duration]);

  // Helper format MM:SS
  const formatTimeAsSeconds = (sec: number) => {
    const s = Math.max(0, sec);
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 10);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms}`;
  };

  // --- Bookmark Callbacks ---
  const handleAddBookmark = (newBm: Omit<Bookmark, "id" | "createdAt">) => {
    const bookmark: Bookmark = {
      ...newBm,
      id: `bm-${Date.now()}`,
      createdAt: Date.now(),
    };
    setBookmarks((prev) => [bookmark, ...prev]);
    showTemporaryNotification("새로운 반복 구간 북마크가 저장되었습니다! 📁");
  };

  const handleDeleteBookmark = (id: string) => {
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
    showTemporaryNotification("북마크가 삭제되었습니다.");
  };

  const handleAddFolder = (name: string, color: string) => {
    const folder: Folder = {
      id: `fold-${Date.now()}`,
      name,
      color,
    };
    setFolders((prev) => [...prev, folder]);
    showTemporaryNotification(`새로운 폴더 '${name}' 가 생성되었습니다 📁`);
  };

  const handleDeleteFolder = (id: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== id));
    // Move all bookmarks in this folder to general category
    setBookmarks((prev) =>
      prev.map((bm) => (bm.folderId === id ? { ...bm, folderId: "" } : bm))
    );
    showTemporaryNotification("폴더삭제 완료 (안의 구간들은 미분류 이동)");
  };

  const handleSelectBookmark = (bm: Bookmark) => {
    // If different video, swap sources first
    if (bm.videoId !== activeVideoId) {
      setActiveVideoId(bm.videoId);
    }
    
    // Set parameters
    setStartTime(bm.startTime);
    setEndTime(bm.endTime);
    setLoopActive(true);
    setPlaybackSpeed(bm.speed);
    
    if (playerRef.current && iframeReadyRef.current) {
      playerRef.current.setPlaybackRate(bm.speed);
    }
    handleSeekToTime(bm.startTime);
    
    showTemporaryNotification(`'${bm.title}' 구간을 원 버튼으로 로드했습니다 ⚡`);
  };

  const handleImportData = (newBms: Bookmark[], newFolders: Folder[]) => {
    if (newBms.length > 0) setBookmarks(newBms);
    if (newFolders.length > 0) setFolders(newFolders);
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans" id="application-loop-root">
      
      {/* 1. Header Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Logo element */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-teal-400 flex items-center justify-center shadow-lg shadow-indigo-600/20">
              <RotateCw className="w-5 h-5 text-slate-950 font-black animate-spin-slow" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg tracking-tight text-white flex items-center gap-2">
                YouTube CutCut 📺
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-indigo-900/50 text-indigo-300 border border-indigo-700/30">
                  Shadowing Loop v3
                </span>
              </h1>
              <p className="text-[10px] text-slate-400">구간 무한 반복 & 정밀 탐색 음학/어학 학습기</p>
            </div>
          </div>

          {/* Load Input Field */}
          <div className="flex items-center gap-2 w-full sm:w-auto max-w-md flex-1">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="유튜브 동영상 링크나 ID를 여기에 붙여넣으세요..."
                value={videoIdInput}
                onChange={(e) => setVideoIdInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") loadNewVideo(videoIdInput);
                }}
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              {videoIdInput && (
                <button
                  type="button"
                  onClick={() => setVideoIdInput("")}
                  className="absolute right-3 top-2 text-slate-400 hover:text-white"
                >
                  ×
                </button>
              )}
            </div>
            <button
              onClick={() => loadNewVideo(videoIdInput)}
              type="button"
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-1.5 rounded-xl font-semibold text-xs transition-colors whitespace-nowrap"
            >
              영상 열기
            </button>
          </div>

          {/* Quick buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={togglePopoutMode}
              type="button"
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer ${
                popoutActive
                  ? "bg-emerald-650/40 text-emerald-300 border border-emerald-500/40 animate-pulse"
                  : "bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/30 shadow-lg shadow-indigo-600/15"
              }`}
              title="듀얼 모니터 사용자를 위해 전용 팝업 비디오 비디오 창을 실행합니다. 2번째 모니터로 드래그하여 전체화면으로 사용하세요."
            >
              <Monitor className="w-4 h-4 text-white" />
              {popoutActive ? "듀얼모니터 전송 중 (클릭 시 닫기) 📺" : "듀얼모니터 전체화면 전송"}
            </button>

            <button
              onClick={() => setShowConfigHotkeys(true)}
              type="button"
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700/60 px-3.5 py-1.5 rounded-xl text-xs text-slate-300 transition-colors cursor-pointer"
            >
              <Keyboard className="w-4 h-4 text-indigo-400" />
              단축키 관리
            </button>
          </div>

        </div>
      </header>

      {/* 2. Main Workspace Grid */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN (Player Deck + Waveform controls) */}
        <section className="lg:col-span-7 xl:col-span-8 space-y-5">
          
          {/* A. Live Video Display Frame Card */}
          <div className="bg-slate-950 border border-slate-800/85 rounded-3xl overflow-hidden shadow-2xl relative">
            
            {/* Visual warning delay overlay */}
            {isCooldownActive && (
              <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-30 flex flex-col items-center justify-center text-center animate-pulse">
                <div className="w-16 h-16 rounded-full border-4 border-amber-505/30 border-t-amber-400 animate-spin-quick mb-4" />
                <h3 className="font-display font-extrabold text-3xl tracking-widest text-amber-400 bg-amber-950/20 px-4 py-1.5 rounded-xl border border-amber-500/20 inline-block">
                  {cooldownTimer} !
                </h3>
                <p className="text-slate-200 mt-2 font-medium text-sm">구간 반복 쿨다운 대기 중 ...</p>
                <p className="text-xs text-slate-400 mt-1">방금 들은 핵심 대목을 따라 복창하거나 메모해 보세요.</p>
              </div>
            )}

            {/* Video current metadata strip */}
            <div className={`p-4 bg-slate-900/45 border-b border-slate-900 flex items-start gap-3 transition-opacity duration-300 ${!activeVideoId ? "opacity-50" : "opacity-100"}`}>
              <img
                src={videoMeta.thumbnail}
                alt=""
                className="w-14 h-11 rounded-lg object-cover bg-slate-850 flex-shrink-0 border border-slate-805"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-[10px] text-indigo-400 font-bold uppercase tracking-wider">
                  <span>📺 {videoMeta.channelTitle}</span>
                  <span className="text-slate-700">|</span>
                  <span className="text-slate-400 font-mono font-medium">총 길이: {activeVideoId ? formatTimeAsSeconds(videoMeta.duration) : "00:00.0"}</span>
                  <span className="text-slate-700">|</span>
                  <span className="text-slate-400 font-mono font-medium">비디오 ID: {activeVideoId || "없음"}</span>
                  {popoutActive && (
                    <>
                      <span className="text-slate-700">|</span>
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-sans animate-pulse Normal uppercase">
                        ● 보조 모니터 전송 중 (동기화 활성)
                      </span>
                    </>
                  )}
                </div>
                <h2 className="text-sm font-semibold text-slate-100 truncate mt-1">
                  {videoMeta.title}
                </h2>
              </div>
            </div>

            {/* Main Window Player Size Adjuster Toolbar Section */}
            <div className="px-4 py-2.5 bg-slate-900/40 border-b border-slate-905 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-1.5 text-slate-300 font-bold select-none">
                <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                <span>메인 동영상 화면 크기 조절</span>
              </div>
              <div className="flex items-center gap-3.5">
                {/* Preset shortcuts selector */}
                <div className="flex items-center gap-1 bg-slate-950/60 p-0.5 rounded-lg border border-slate-800/60">
                  {[
                    { label: "작게 (50%)", val: 50 },
                    { label: "중간 (75%)", val: 75 },
                    { label: "기본 (100%)", val: 100 },
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => setPlayerSize(preset.val)}
                      className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-all ${
                        playerSize === preset.val
                          ? "bg-indigo-600 text-white"
                          : "text-slate-400 hover:text-white hover:bg-slate-800"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 flex-1 sm:w-40">
                  <input
                    type="range"
                    min="40"
                    max="100"
                    step="5"
                    value={playerSize}
                    onChange={(e) => setPlayerSize(Number(e.target.value))}
                    className="w-full accent-indigo-500 cursor-pointer h-1 bg-slate-800 rounded-lg appearance-none"
                    style={{ background: `linear-gradient(to right, rgb(99, 102, 241) 0%, rgb(99, 102, 241) ${((playerSize - 40) / 60) * 100}%, rgb(30, 41, 59) ${((playerSize - 40) / 60) * 100}%, rgb(30, 41, 59) 100%)` }}
                  />
                  <span className="text-xs font-mono text-indigo-400 font-bold w-9 text-right block">
                    {playerSize}%
                  </span>
                </div>
              </div>
            </div>

            {/* Embed Video Area */}
            <div className="w-full bg-black relative">
              <div 
                style={{ maxWidth: `${playerSize}%`, margin: "0 auto" }}
                className="aspect-video w-full bg-black relative transition-all duration-200 overflow-hidden" 
                id="youtube-player-container-ref"
              >
                {activeVideoId ? (
                  <div id="youtube-player-frame" className={`w-full h-full ${popoutActive ? "invisible opacity-0 pointer-events-none absolute w-0 h-0" : ""}`} />
                ) : (
                  <div className="w-full h-full bg-slate-950 flex flex-col items-center justify-center text-slate-500 p-6 text-center select-none">
                    <div className="relative mb-3">
                      <div className="absolute inset-0 bg-indigo-505/10 blur-xl rounded-full" />
                      <Monitor className="w-11 h-11 text-indigo-400/40 relative z-10" />
                    </div>
                    <p className="text-xs font-bold text-slate-300">구간반복 학습 동영상 대기 중 📺</p>
                    <p className="text-[11px] text-slate-500 max-w-sm mt-1.5 leading-relaxed">
                      상단 입력창에 유튜브 영상 주소를 입력하거나, 우측 하단의 <span className="text-indigo-400 font-semibold">[인스턴스 추천 리스트]</span>에서 관심 있는 영상을 선택해 주세요!
                    </p>
                  </div>
                )}

                {/* 듀얼모니터 전송 중 오버레이 플레이트 */}
                {activeVideoId && popoutActive && (
                  <div className="absolute inset-0 bg-slate-950/98 flex flex-col items-center justify-center text-slate-300 z-30 p-6 text-center select-none border border-indigo-505/30 rounded-xl overflow-hidden">
                    <div className="relative mb-5 flex items-center justify-center">
                      <div className="absolute w-24 h-24 bg-indigo-505/15 blur-3xl rounded-full" />
                      <div className="flex items-center gap-4 relative z-10">
                        <div className="flex flex-col items-center">
                          <Monitor className="w-10 h-10 text-slate-600" />
                          <span className="text-[9px] text-slate-500 font-bold mt-1">메인 화면 (비었음)</span>
                        </div>
                        <div className="flex flex-col items-center animate-pulse">
                          <span className="text-sm text-indigo-400 font-extrabold font-mono tracking-widest">──✈──▶</span>
                          <span className="text-[8px] bg-indigo-505/20 text-indigo-300 px-1 py-0.2 rounded font-semibold mt-1">영상 신호 이탈</span>
                        </div>
                        <div className="flex flex-col items-center select-none">
                          <div className="relative">
                            <div className="absolute inset-x-0 bottom-0 bg-emerald-500/20 blur-md h-full rounded" />
                            <Monitor className="w-10 h-10 text-emerald-400 font-bold" />
                          </div>
                          <span className="text-[9px] text-emerald-400 font-bold mt-1">보조 화면 (재생 중)</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm font-extrabold text-indigo-300 tracking-wide">
                      동영상이 보조 윈도우로 완벽하게 전송(이탈)되었습니다! 🛸
                    </p>
                    <p className="text-[11px] text-slate-400 max-w-md mt-2 leading-relaxed">
                      이중 사운드 간섭 및 배터리 자원 부하를 막기 위해 <br />
                      <strong>메인 윈도우의 동영상은 비활성화(숨김)</strong> 상태로 유지됩니다. <br />
                      보조 모니터 팝업 창에서 최적의 화질로 구간 반복을 감상하세요!
                    </p>
                    <button
                      type="button"
                      onClick={togglePopoutMode}
                      className="mt-4 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-550 text-white rounded-lg text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
                    >
                      전송 종료 및 메인 화면으로 비디오 회수
                    </button>
                  </div>
                )}

                {/* Elegant dark loading overlay to hide Youtube rendering flashes */}
                {activeVideoId && !isPlayerReady && (
                  <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center text-slate-400 z-20 select-none">
                    <div className="w-8 h-8 rounded-full border-2 border-indigo-500/25 border-t-indigo-500 animate-spin mb-3" />
                    <span className="text-[11px] font-mono tracking-widest text-indigo-400/80 animate-pulse">
                      LOADING MEDIA CONTENT...
                    </span>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* B. Dynamic Audio Waveform scrubbing timeline */}
          <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800">
            {/* Custom drag-capable Waveform timeline */}
            <WaveformTimeline
              duration={videoMeta.duration}
              currentTime={currentTime}
              startTime={startTime}
              endTime={endTime}
              onChangeStart={setStartTime}
              onChangeEnd={setEndTime}
              onSeek={(sec) => {
                handleSeekToTime(sec);
              }}
              videoId={activeVideoId}
            />

            {/* Quick Micro Adjusters for Start & End Ranges */}
            <div className="grid grid-cols-2 gap-4 mt-4">
              
              {/* Range A Set Deck */}
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                    🟢 시작점 지정 (A)
                  </span>
                  <button
                    onClick={() => {
                      const current = playerRef.current ? playerRef.current.getCurrentTime() : currentTime;
                      setStartTime(Math.max(0, Math.min(current, endTime - 0.2)));
                      showTemporaryNotification("현시점을 시작점(A)에 담았습니다 📍");
                    }}
                    type="button"
                    title="현재 플레이어 시점 입력"
                    className="text-[10.5px] text-emerald-300 font-semibold flex items-center gap-0.5 bg-emerald-500/15 hover:bg-emerald-500/30 px-2 py-0.5 rounded border border-emerald-500/20 transition-colors"
                  >
                     현시점으로 캡처 [Q]
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max={endTime - 0.2}
                    value={startTime.toFixed(1)}
                    onChange={(e) => setStartTime(Math.max(0, Math.min(parseFloat(e.target.value) || 0, endTime - 0.2)))}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 font-mono focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500 font-mono">초</span>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => setStartTime(prev => Math.max(0, prev - 1))}
                      type="button"
                      className="px-1.5 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-mono"
                    >
                      -1s
                    </button>
                    <button
                      onClick={() => setStartTime(prev => Math.min(endTime - 0.2, prev + 1))}
                      type="button"
                      className="px-1.5 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-mono"
                    >
                      +1s
                    </button>
                  </div>
                </div>
              </div>

              {/* Range B Set Deck */}
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-rose-400 flex items-center gap-1">
                    🔴 종료점 지정 (B)
                  </span>
                  <button
                    onClick={() => {
                      const current = playerRef.current ? playerRef.current.getCurrentTime() : currentTime;
                      setEndTime(Math.max(startTime + 0.2, Math.min(current, videoMeta.duration)));
                      showTemporaryNotification("현시점을 종료점(B)에 담았습니다 📍");
                    }}
                    type="button"
                    title="현재 플레이어 시점 입력"
                    className="text-[10.5px] text-rose-300 font-semibold flex items-center gap-0.5 bg-rose-500/15 hover:bg-rose-500/30 px-2 py-0.5 rounded border border-rose-500/20 transition-colors"
                  >
                     현시점으로 캡처 [W]
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="0.1"
                    min={startTime + 0.2}
                    max={videoMeta.duration}
                    value={endTime.toFixed(1)}
                    onChange={(e) => setEndTime(Math.max(startTime + 0.2, Math.min(parseFloat(e.target.value) || 0, videoMeta.duration)))}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 font-mono focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500 font-mono">초</span>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => setEndTime(prev => Math.max(startTime + 0.2, prev - 1))}
                      type="button"
                      className="px-1.5 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-mono"
                    >
                      -1s
                    </button>
                    <button
                      onClick={() => setEndTime(prev => Math.min(videoMeta.duration, prev + 1))}
                      type="button"
                      className="px-1.5 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-mono"
                    >
                      +1s
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* C. Interactive Controller Play Deck (Play/Pause, Step times, frame control) */}
          <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 space-y-4">

            {/* Core Buttons Layout (Play, Pause, +/- 10s, seek index targets) */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              
              <div className="flex items-center gap-2">
                {/* 10 seconds back */}
                <button
                  onClick={() => handleSeekRelative(-10)}
                  type="button"
                  title="10초 뒤로 탐색"
                  className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-355 transition-colors"
                >
                  <SkipBack className="w-4 h-4" />
                </button>

                {/* Main Play Toggle button */}
                <button
                  onClick={handleTogglePlay}
                  type="button"
                  className="flex items-center gap-2 bg-indigo-505 hover:bg-indigo-400 text-slate-950 hover:text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg shadow-indigo-500/10 transition-all"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-4 h-4 fill-current" />
                      일시 정지
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      동영상 재생
                    </>
                  )}
                </button>

                {/* 10 seconds forward */}
                <button
                  onClick={() => handleSeekRelative(10)}
                  type="button"
                  title="10초 앞으로 탐색"
                  className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-355 transition-colors"
                >
                  <SkipForward className="w-4 h-4" />
                </button>

                {/* Restart Loop Target A point instantly */}
                <button
                  onClick={() => {
                    handleSeekToTime(startTime);
                    if (playerRef.current) {
                      playerRef.current.playVideo();
                    }
                    setIsPlaying(true);
                    showTemporaryNotification("A 포인트로 순간이동하여 재생을 시작합니다 ⚡");
                  }}
                  type="button"
                  className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 py-2.5 px-3.5 rounded-xl transition-all font-medium"
                >
                  A로 시작
                </button>
              </div>

              {/* Instant Frame by Frame controls positioned between Play buttons and Playback Speed */}
              <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-1.5 rounded-xl">
                <span className="text-[10px] text-slate-400 px-2 font-bold whitespace-nowrap">프레임 미세이동 :</span>
                <button
                  onClick={() => handleFrameSeek(false)}
                  type="button"
                  title="프레임 단위 1보 후진 (단축키: ,)"
                  className="px-2.5 py-1 text-[11px] bg-slate-850 hover:bg-slate-750 border border-slate-800/60 rounded text-indigo-300 font-bold font-mono transition-colors"
                >
                  ◀ 1f
                </button>
                <button
                  onClick={() => handleFrameSeek(true)}
                  type="button"
                  title="프레임 단위 1보 전진 (단축키: .)"
                  className="px-2.5 py-1 text-[11px] bg-slate-850 hover:bg-slate-755 border border-slate-800/60 rounded text-indigo-300 font-bold font-mono transition-colors"
                >
                  1f ▶
                </button>
              </div>

              {/* Continuous speed rate manager */}
              <div className="flex items-center gap-3 bg-slate-950 border border-slate-800 p-2.5 rounded-xl flex-1 max-w-xs">
                <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap">
                  재생 속도: <strong className="text-indigo-400">{playbackSpeed.toFixed(2)}x</strong>
                </span>
                <input
                  type="range"
                  min="0.25"
                  max="2.00"
                  step="0.05"
                  value={playbackSpeed}
                  onChange={(e) => changeSpeedFactor(parseFloat(e.target.value))}
                  className="w-full accent-indigo-550 cursor-ew-resize h-1 bg-slate-800 rounded-lg appearance-none"
                />
              </div>

            </div>

            {/* Quick Speed presets */}
            <div className="flex flex-wrap items-center gap-1 px-1">
              <span className="text-[10px] text-slate-500 mr-2 font-semibold">속도 프리셋:</span>
              {[0.5, 0.75, 0.8, 0.9, 1.0, 1.15, 1.25, 1.5, 2.0].map((s) => (
                <button
                  key={s}
                  onClick={() => changeSpeedFactor(s)}
                  type="button"
                  className={`px-2.5 py-1 text-[10.5px] rounded-lg font-mono tracking-tight transition-colors ${
                    Math.abs(playbackSpeed - s) < 0.01
                      ? "bg-indigo-500 text-slate-950 font-bold"
                      : "bg-slate-950 hover:bg-slate-800 text-slate-400"
                  }`}
                >
                  {s.toFixed(2)}x
                </button>
              ))}
            </div>

          </div>

        </section>

        {/* RIGHT COLUMN (Bookmarks list panel & File configuration manager) */}
        <aside className="lg:col-span-5 xl:col-span-4 bg-slate-950/40 rounded-3xl p-4 border border-slate-800 space-y-4">
          
          {/* 구간 반복 설정 (Loop Repeater Settings) */}
          <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-indigo-300 flex items-center gap-2">
              <RotateCw className="w-4.5 h-4.5 text-indigo-400 animate-spin-slow" />
              구간 반복 설정
            </h4>
            
            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => setLoopActive(!loopActive)}
                type="button"
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  loopActive
                    ? "bg-indigo-600/30 text-indigo-400 border border-indigo-500/40"
                    : "bg-slate-950 text-slate-400 border border-slate-800"
                }`}
              >
                <div className="flex items-center gap-2 text-left">
                  <span className={`w-2.5 h-2.5 rounded-full inline-block ${loopActive ? "bg-indigo-400 animate-pulse" : "bg-slate-600"}`} />
                  <span>반복 활성화 [{hotkeys.loopToggle}]</span>
                </div>
                <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded leading-none">
                  {loopActive ? "켜짐" : "꺼짐"}
                </span>
              </button>

              <div className="flex flex-col gap-2.5">
                {/* Auto Cooldown setup */}
                <div className="flex items-center justify-between bg-slate-950 border border-slate-800 py-1.5 px-3 rounded-xl text-xs text-slate-300">
                  <span className="text-slate-450 font-medium font-sans">지연 정지 대기:</span>
                  <select
                    value={cooldownDelay}
                    onChange={(e) => setCooldownDelay(parseInt(e.target.value))}
                    className="bg-transparent border-0 text-amber-450 font-bold focus:outline-none cursor-pointer"
                  >
                    <option value={0} className="bg-slate-900">없음 (0초)</option>
                    <option value={1} className="bg-slate-900">1초 정지</option>
                    <option value={2} className="bg-slate-900">2초 정지</option>
                    <option value={3} className="bg-slate-900">3초 정지</option>
                  </select>
                </div>

                {/* Auto beep countdown toggling */}
                {cooldownDelay > 0 && (
                  <label className="flex items-center justify-between bg-slate-950 border border-slate-800 py-1.5 px-3 rounded-xl text-xs text-slate-300 select-none cursor-pointer">
                    <span className="text-slate-400 font-sans">카운트다운 비프음:</span>
                    <input
                      type="checkbox"
                      checked={countdownIntro}
                      onChange={(e) => setCountdownIntro(e.target.checked)}
                      className="rounded bg-slate-950 border-slate-850 text-indigo-500 focus:ring-0"
                    />
                  </label>
                )}
              </div>
            </div>
          </div>

          <BookmarkManager
            bookmarks={bookmarks}
            folders={folders}
            currentVideoId={activeVideoId}
            currentA={startTime}
            currentB={endTime}
            currentSpeed={playbackSpeed}
            onAddBookmark={handleAddBookmark}
            onDeleteBookmark={handleDeleteBookmark}
            onAddFolder={handleAddFolder}
            onDeleteFolder={handleDeleteFolder}
            onSelectBookmark={handleSelectBookmark}
            onImportData={handleImportData}
          />

          {/* 인스턴스 추천 리스트 (Preset recommendations list) */}
          <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800/80 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-400" />
              인스턴스 추천 학습 리스트
            </h4>
            <div className="flex flex-col gap-2">
              {PRESET_VIDEOS.map((item) => {
                const IconComponent = item.icon;
                const isActive = item.id === activeVideoId;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveVideoId(item.id)}
                    type="button"
                    className={`p-2.5 rounded-xl border text-left transition-all group flex items-start gap-2.5 cursor-pointer ${
                      isActive
                        ? "bg-indigo-950/40 border-indigo-500/80"
                        : "bg-slate-950/50 hover:bg-slate-950 border-slate-800/80 hover:border-slate-700"
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${isActive ? "bg-indigo-500/20 text-indigo-300" : "bg-slate-900 text-slate-400 group-hover:text-indigo-400"} transition-colors`}>
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 overflow-hidden">
                        <span className="text-[9px] uppercase font-extrabold text-indigo-400 font-mono tracking-tight shrink-0">
                          {item.tag}
                        </span>
                        <span className="text-[9px] text-slate-500 font-mono truncate max-w-[80px]">
                          {item.channel}
                        </span>
                      </div>
                      <h5 className="text-[11.5px] font-semibold text-slate-200 truncate mt-0.5" title={item.title}>
                        {item.title}
                      </h5>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

        </aside>

      </main>

      {/* 3. Global Dynamic hotkey binding indicator notification bubble */}
      {hotkeyNotification && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-900 border-2 border-indigo-500/50 text-indigo-200 py-2.5 px-5 rounded-2xl shadow-2xl flex items-center gap-2.5 z-55 animate-bounce font-medium text-xs">
          <Sparkles className="w-4 h-4 text-indigo-400 animate-spin-slow" />
          {hotkeyNotification.text}
        </div>
      )}

      {/* 4. Keyboard binding config Modal */}
      {showConfigHotkeys && (
        <HotkeySettings
          config={hotkeys}
          onUpdate={setHotkeys}
          onClose={() => setShowConfigHotkeys(false)}
        />
      )}

      {/* 5. Compact minimalist clean Footer */}
      <footer className="mt-auto py-5 bg-slate-950/80 border-t border-slate-900/60 text-center text-slate-500 text-[10.5px]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 YouTube Loop Master. Designed for Shadowing & Instrumental repetition.</p>
          <div className="flex items-center gap-3">
            <span>마우스 없이 키보드 단축키(Q, W, L, Space)로 더 빠르게 제어하세요.</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
