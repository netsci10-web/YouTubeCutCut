import React, { useState, useEffect, useRef } from "react";
import { Bookmark, Folder, HotkeyConfig, VideoMetadata, DEFAULT_HOTKEYS } from "./types";
import { WaveformTimeline } from "./components/WaveformTimeline";
import { HotkeySettings } from "./components/HotkeySettings";
import { BookmarkManager } from "./components/BookmarkManager";
import { 
  Play, Pause, Square, RotateCw, SkipBack, SkipForward, Flame, Keyboard, Info, Check, AlertCircle,
  HelpCircle, Sparkles, Sliders, Volume2, VolumeX, Globe, Music, GraduationCap, Monitor, Search, Loader2,
  Plus, Download, Upload, Repeat, Brain, Cpu, Eye, Languages
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

  const [activeBookmarkId, setActiveBookmarkId] = useState<string | null>(null);
  const [isSequentialPlayActive, setIsSequentialPlayActive] = useState<boolean>(() => {
    const saved = localStorage.getItem("yt_loop_sequential_play");
    return saved === "true";
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
  const [loopActive, setLoopActive] = useState(false);
  const [isRangeEnabled, setIsRangeEnabled] = useState(true);
  const [startTime, setStartTime] = useState(10);
  const [endTime, setEndTime] = useState(40);
  const [isStartSet, setIsStartSet] = useState(false);
  const [isEndSet, setIsEndSet] = useState(false);

  const updateStartTime = (val: number) => {
    setStartTime(val);
    setIsStartSet(true);
  };

  const updateEndTime = (val: number) => {
    setEndTime(val);
    setIsEndSet(true);
  };

  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [playerVolume, setPlayerVolume] = useState<number>(() => {
    const saved = localStorage.getItem("yt_loop_player_volume");
    return saved ? parseInt(saved, 10) : 100;
  });
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    const saved = localStorage.getItem("yt_loop_player_is_muted");
    return saved === "true";
  });

  useEffect(() => {
    localStorage.setItem("yt_loop_player_is_muted", String(isMuted));
  }, [isMuted]);
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
  const lastVolumeActionTimeRef = useRef<number>(0);
  const lastVideoLoadedTimeRef = useRef<number>(0);
  const skipInitialResetRef = useRef<boolean>(false);
  const loadedFromBookmarkRef = useRef<{ startTime: number; endTime: number; volume?: number } | null>(null);
  const isInitializingRef = useRef<boolean>(false);
  const autoPlayIntentRef = useRef<boolean>(false);

  // --- Popout Mode Management for Second Monitor Fullscreen ---
  const popoutWindowRef = useRef<Window | null>(null);
  const [popoutActive, setPopoutActive] = useState(false);
  const [playerSize, setPlayerSize] = useState<number>(100); // Main video player size percent (50% to 100%)
  const [isPlayerReady, setIsPlayerReady] = useState(false);

  // --- YouTube Iframe Player API Dynamic States ---
  const [apiPlayerState, setApiPlayerState] = useState<number>(-1);
  const [apiAvailableQualities, setApiAvailableQualities] = useState<string[]>([]);
  const [apiCurrentQuality, setApiCurrentQuality] = useState<string>("");
  const [apiAvailableRates, setApiAvailableRates] = useState<number[]>([]);
  const [apiLoadedFraction, setApiLoadedFraction] = useState<number>(0);
  const [apiVideoData, setApiVideoData] = useState<{ title: string; author: string; video_id: string } | null>(null);
  const [apiCaptionsEnabled, setApiCaptionsEnabled] = useState<boolean>(false);
  const [apiVolume, setApiVolume] = useState<number>(100);
  const [apiIsMuted, setApiIsMuted] = useState<boolean>(false);

  const updateIframeApiStates = () => {
    if (!playerRef.current || !iframeReadyRef.current) return;
    try {
      if (typeof playerRef.current.getPlayerState === "function") {
        setApiPlayerState(playerRef.current.getPlayerState());
      }
      if (typeof playerRef.current.getAvailableQualityLevels === "function") {
        const qualities = playerRef.current.getAvailableQualityLevels();
        if (Array.isArray(qualities)) {
          setApiAvailableQualities(qualities);
        }
      }
      if (typeof playerRef.current.getPlaybackQuality === "function") {
        setApiCurrentQuality(playerRef.current.getPlaybackQuality());
      }
      if (typeof playerRef.current.getAvailablePlaybackRates === "function") {
        const rates = playerRef.current.getAvailablePlaybackRates();
        if (Array.isArray(rates)) {
          setApiAvailableRates([...rates].sort((a: number, b: number) => a - b));
        }
      }
      if (typeof playerRef.current.getVideoLoadedFraction === "function") {
        setApiLoadedFraction(playerRef.current.getVideoLoadedFraction());
      }
      if (typeof playerRef.current.getVideoData === "function") {
        const data = playerRef.current.getVideoData();
        if (data && typeof data === "object") {
          setApiVideoData({
            title: data.title || "",
            author: data.author || "",
            video_id: data.video_id || "",
          });
        }
      }
      if (typeof playerRef.current.getVolume === "function") {
        setApiVolume(playerRef.current.getVolume());
      }
      if (typeof playerRef.current.isMuted === "function") {
        setApiIsMuted(playerRef.current.isMuted());
      }
    } catch (e) {
      // Ignore transient errors
    }
  };

  // --- AI Smart Extraction States ---
  const [aiAnalysisCache, setAiAnalysisCache] = useState<Record<string, { topic: string; sentences: any[]; scenes: any[]; isRealAi: boolean; note?: string }>>({});
  const [isAnalyzingVideo, setIsAnalyzingVideo] = useState(false);
  const [analysisTab, setAnalysisTab] = useState<"speech" | "vision">("speech");

  const handleAnalyzeVideo = async () => {
    if (!activeVideoId) {
      showTemporaryNotification("먼저 분석할 유튜브 영상을 로드해 주세요 📺");
      return;
    }
    
    setIsAnalyzingVideo(true);
    showTemporaryNotification("AI 스마트 구간 분석을 시작합니다... ✨");

    try {
      const response = await fetch("/api/gemini/analyze-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: activeVideoId,
          videoTitle: videoMeta.title,
          duration: videoMeta.duration,
        }),
      });

      if (!response.ok) {
        throw new Error("서버 통신 실패");
      }

      const data = await response.json();
      setAiAnalysisCache((prev) => ({
        ...prev,
        [activeVideoId]: data,
      }));
      showTemporaryNotification("AI 스마트 구간 분석이 완료되었습니다 🚀");
    } catch (e: any) {
      console.error("AI Analysis error:", e);
      showTemporaryNotification("분석 과정에서 오류가 발생했습니다 ⚠️");
    } finally {
      setIsAnalyzingVideo(false);
    }
  };

  // --- YouTube Search States ---
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchCollapsed, setSearchCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem("yt_loop_search_collapsed");
    return saved === "true";
  });
  const [aiCardCollapsed, setAiCardCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem("yt_loop_ai_card_collapsed");
    return saved === "true";
  });
  const [apiCardCollapsed, setApiCardCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem("yt_loop_api_card_collapsed");
    return saved === "true";
  });

  const handleYoutubeSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setIsSearching(true);
    setSearchError(null);
    try {
      let data;
      try {
        const response = await fetch(`/api/youtube-search?q=${encodeURIComponent(query)}`);
        if (!response.ok) {
          throw new Error("Local backend search failed");
        }
        data = await response.json();
      } catch (backendErr) {
        // Static file server fallback: fetch directly from YouTube API on the client side
        const fallbackApiKey = "AIzaSyA3dXC8mF32ItPvd5wUDBt-uUWZvonvY5Q";
        const fallbackUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(query)}&maxResults=10&key=${fallbackApiKey}`;
        const directResponse = await fetch(fallbackUrl);
        if (!directResponse.ok) {
          throw new Error("유튜브 검색 API 호출에 실패했습니다 (서버 미작동 및 API 할당량 제한 등).");
        }
        const ytData = await directResponse.json();
        const items = (ytData.items || []).map((item: any) => {
          const titleRaw = item.snippet?.title || "Unknown Title";
          const title = titleRaw
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>');
          return {
            id: item.id?.videoId || "",
            title: title,
            channelTitle: item.snippet?.channelTitle || "YouTube Channel",
            thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || "",
          };
        }).filter((item: any) => item.id !== "");
        data = { items };
      }
      setSearchResults(data.items || []);
    } catch (err: any) {
      setSearchError(err.message || "유튜브 검색 중 오류가 발생했습니다.");
    } finally {
      setIsSearching(false);
    }
  };

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
          
          // Secure lockdown to make absolutely sure the main video behind does not play sound
          if (playerRef.current && iframeReadyRef.current) {
            try {
              playerRef.current.mute();
            } catch (err) {}
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
      currentTime,
      playerVolume,
      isMuted
    });
  }, [activeVideoId, startTime, endTime, loopActive, playbackSpeed, isPlaying, playerVolume, isMuted]);

  // Prevent main player from producing overlapping audio when popout is active.
  // It locks the main player to a completely muted state during dual-monitor presentation to let the user scrub on the main screen,
  // and properly restores the sound and mute preferences when the popout player is turned off.
  useEffect(() => {
    if (!playerRef.current || !iframeReadyRef.current) return;
    try {
      if (popoutActive) {
        playerRef.current.mute();
      } else {
        if (isMuted) {
          playerRef.current.mute();
        } else {
          playerRef.current.unMute();
          playerRef.current.setVolume(playerVolume);
        }
      }
    } catch (e) {}
  }, [popoutActive, isMuted, playerVolume, activeVideoId]);

  // 브라우저의 Autoplay 보안 정책을 시원하게 조율할 수 있는 최초 스크린 터치/클릭 해제 리스너 등록
  useEffect(() => {
    const handleFirstUserInteraction = () => {
      if (playerRef.current && iframeReadyRef.current) {
        try {
          const savedVol = localStorage.getItem("yt_loop_player_volume");
          const vol = savedVol ? parseInt(savedVol, 10) : playerVolume;
          const savedMuted = localStorage.getItem("yt_loop_player_is_muted") === "true";
          
          if (!savedMuted && !popoutActive) {
            playerRef.current.unMute();
            playerRef.current.setVolume(vol);
            setIsMuted(false);
          } else if (savedMuted) {
            playerRef.current.mute();
            setIsMuted(true);
          }
        } catch (e) {}
      }
      // 단 1회 실행 후 자체 폐기
      window.removeEventListener("click", handleFirstUserInteraction);
      window.removeEventListener("touchstart", handleFirstUserInteraction);
    };

    window.addEventListener("click", handleFirstUserInteraction);
    window.addEventListener("touchstart", handleFirstUserInteraction);
    return () => {
      window.removeEventListener("click", handleFirstUserInteraction);
      window.removeEventListener("touchstart", handleFirstUserInteraction);
    };
  }, [popoutActive, playerVolume]);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem("yt_loop_bookmarks", JSON.stringify(bookmarks));
  }, [bookmarks]);

  useEffect(() => {
    localStorage.setItem("yt_loop_sequential_play", JSON.stringify(isSequentialPlayActive));
  }, [isSequentialPlayActive]);

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
        let data;
        try {
          const res = await fetch(`/api/youtube-meta?videoId=${encodeURIComponent(activeVideoId)}`);
          if (!res.ok) throw new Error("Metadata API resolution failed");
          data = await res.json();
        } catch (backendErr) {
          // Static file server fallback: fetch directly from YouTube API on the client side (e.g. GitHub Pages)
          const fallbackApiKey = "AIzaSyA3dXC8mF32ItPvd5wUDBt-uUWZvonvY5Q";
          const fallbackUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${encodeURIComponent(activeVideoId)}&key=${fallbackApiKey}`;
          const directRes = await fetch(fallbackUrl);
          if (!directRes.ok) throw new Error("Direct YouTube API load failed");
          
          const ytData = await directRes.json();
          if (ytData.items && ytData.items.length > 0) {
            const item = ytData.items[0];
            const title = item.snippet?.title || "Unknown Title";
            const channelTitle = item.snippet?.channelTitle || "Unknown Channel";
            const imgObj = item.snippet?.thumbnails?.high || item.snippet?.thumbnails?.medium || item.snippet?.thumbnails?.default;
            const thumbnail = imgObj?.url || `https://img.youtube.com/vi/${activeVideoId}/hqdefault.jpg`;
            const durationStr = item.contentDetails?.duration || "";
            
            // Parse ISO 8601 duration
            const durationRegex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
            const matches = durationStr.match(durationRegex);
            let durationSeconds = 0;
            if (matches) {
              const hours = parseInt(matches[1] || "0", 10);
              const minutes = parseInt(matches[2] || "0", 10);
              const seconds = parseInt(matches[3] || "0", 10);
              durationSeconds = hours * 3600 + minutes * 60 + seconds;
            }
            durationSeconds = durationSeconds || 300;
            
            data = {
              title,
              channelTitle,
              thumbnail,
              duration: durationSeconds
            };
          } else {
            throw new Error("No video item found in response");
          }
        }
        
        setVideoMeta({
          videoId: activeVideoId,
          title: data.title || "YouTube Video",
          channelTitle: data.channelTitle || "YouTube Channel",
          thumbnail: data.thumbnail || `https://img.youtube.com/vi/${activeVideoId}/hqdefault.jpg`,
          duration: data.duration || 300,
          loading: false
        });

        // Initialize markers
        if (skipInitialResetRef.current) {
          skipInitialResetRef.current = false;
          setIsStartSet(true);
          setIsEndSet(true);
          if (loadedFromBookmarkRef.current) {
            setStartTime(loadedFromBookmarkRef.current.startTime);
            setEndTime(loadedFromBookmarkRef.current.endTime);
          }
        } else {
          setStartTime(0);
          setEndTime(data.duration || 300);
          setIsStartSet(false);
          setIsEndSet(false);
        }
      } catch (err: any) {
        console.warn("Could not fetch video meta securely, using client values:", err.message);
        setVideoMeta({
          videoId: activeVideoId,
          title: "YouTube Video Resource",
          channelTitle: "Media Node",
          thumbnail: `https://img.youtube.com/vi/${activeVideoId}/hqdefault.jpg`,
          duration: 300,
          loading: false,
          error: "API Key Metadata fallback"
        });
        if (skipInitialResetRef.current) {
          skipInitialResetRef.current = false;
          setIsStartSet(true);
          setIsEndSet(true);
          if (loadedFromBookmarkRef.current) {
            setStartTime(loadedFromBookmarkRef.current.startTime);
            setEndTime(loadedFromBookmarkRef.current.endTime);
          }
        } else {
          setStartTime(0);
          setEndTime(300);
          setIsStartSet(false);
          setIsEndSet(false);
        }
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
        // 팝업 전송(듀얼 모니터 송출) 상태일 때는 소리 중첩(하울링)을 막기 위해 메인 비디오를 강제로 음소거 상태로 봉쇄합니다.
        if (popoutActive) {
          try {
            if (typeof playerRef.current.mute === "function") {
              playerRef.current.mute();
            }
          } catch (e) {}
        }

        // 볼륨 역방향 실동기화: 비디오가 정상 재생 중일 때, 사용자가 유튜브 플레이어 자체 화면 조종계로 구동한 볼륨 및 음소거 변경 수치를 완벽히 상호 동기화(연동)시킵니다.
        // 단, 최근에 사용자가 직접 앱에서 볼륨 조정이나 음소거 전환을 한 경우 일정 시간 동기화를 우회해 레이스 컨디션을 방지합니다.
        // 추가로, 초기 구성 중(isInitializingRef)이거나 비디오 로드 후 극초반 대기 기간(5초) 동안은 동기화를 우회하여 자동재생 등의 부작용으로 발생한 무조건 전송 muted 상태가 사용자 본래 설정을 덮어쓰지 않도록 원천 봉쇄합니다.
        try {
          if (!popoutActive) {
            const isRecentlyPrepared = isInitializingRef.current || (Date.now() - lastVideoLoadedTimeRef.current < 5000);
            if (!isRecentlyPrepared && Date.now() - lastVolumeActionTimeRef.current > 2000 && typeof playerRef.current.getPlayerState === "function" && playerRef.current.getPlayerState() === 1) {
              const ytIsMuted = typeof playerRef.current.isMuted === "function" ? playerRef.current.isMuted() : false;
              // 음소거 상태 상호 동기화
              if (ytIsMuted !== isMuted) {
                setIsMuted(ytIsMuted);
              }
              if (!ytIsMuted && typeof playerRef.current.getVolume === "function") {
                const ytVol = playerRef.current.getVolume();
                // 브라우저 자동 재생 제재 등으로 일시적 0% 볼륨인 경우를 제외하고 유효한 볼륨 변경을 연동
                if (typeof ytVol === "number" && ytVol > 0 && ytVol !== playerVolume) {
                  setPlayerVolume(ytVol);
                  localStorage.setItem("yt_loop_player_volume", ytVol.toString());
                }
              }
            }
          }
        } catch (volSyncErr) {}

        // Grab precise timestamp directly from Youtube player Iframe API
        const time = playerRef.current.getCurrentTime();
        if (typeof time === "number" && !isNaN(time)) {
          // 메인 화면속 유튜브 전용 플레이타임 조절바 드래그 등을 감지하여 보조 팝업 영상의 재생 위치(Timehead)도 즉각 미러링시킵니다.
          if (popoutActive && Math.abs(time - currentTime) > 0.5) {
            syncPopoutWithParent("seek", { currentTime: time });
          }

          setCurrentTime(time);

          // Loop repeat check bounding (only if range function is enabled)
          if (isRangeEnabled && isEndSet && time >= endTime) {
            if (loopActive) {
              handleRepeatReset();
            } else {
              try {
                const playerState = typeof playerRef.current.getPlayerState === "function" 
                  ? playerRef.current.getPlayerState() 
                  : null;
                if (playerState === 1) { // PLAYING
                  playerRef.current.pauseVideo();
                  playerRef.current.seekTo(endTime, true);
                  setIsPlaying(false);
                  showTemporaryNotification("구간 끝 지점에 도달하여 일시정지 상태로 대기합니다 ⏹️");
                }
              } catch (e) {}
            }
          }
        }

        // 메인 플레이어에서의 재생 상태(Play/Pause) 변경을 주기적으로 감지하여 보조 윈도우 영상과 미러링을 완료합니다.
        if (typeof playerRef.current.getPlayerState === "function") {
          const ytState = playerRef.current.getPlayerState();
          const ytIsPlaying = (ytState === 1); // 1 = PLAYING
          if (ytIsPlaying !== isPlaying) {
            setIsPlaying(ytIsPlaying);
            if (popoutActive) {
              syncPopoutWithParent("sync_state", {
                videoId: activeVideoId,
                startTime,
                endTime,
                loopActive,
                playbackSpeed,
                isPlaying: ytIsPlaying,
                currentTime: time,
                playerVolume,
                isMuted
              });
            }
          }
        }

        updateIframeApiStates();
      } catch (err) {
        // Player state is unavailable/initializing
      }
    }, 150);

    return () => {
      if (loopIntervalRef.current) clearInterval(loopIntervalRef.current);
    };
  }, [startTime, endTime, loopActive, isRangeEnabled, isCooldownActive, cooldownDelay, countdownIntro, popoutActive, playerVolume, isMuted]);

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

  // Play the next bookmark in the checked playlist sequentially
  const playNextSequentialBookmark = (direction: "forward" | "backward" = "forward") => {
    const checkedBMs = bookmarks.filter((bm) => bm.checked !== false);
    if (checkedBMs.length === 0) {
      if (playerRef.current) {
        playerRef.current.seekTo(startTime, true);
        setCurrentTime(startTime);
      }
      return;
    }

    let nextIndex = 0;
    const currentIndex = checkedBMs.findIndex((bm) => bm.id === activeBookmarkId);
    if (currentIndex === -1) {
      nextIndex = direction === "forward" ? 0 : checkedBMs.length - 1;
    } else {
      if (direction === "forward") {
        nextIndex = (currentIndex + 1) % checkedBMs.length;
      } else {
        nextIndex = (currentIndex - 1 + checkedBMs.length) % checkedBMs.length;
      }
    }

    const nextBM = checkedBMs[nextIndex];
    handleSelectBookmark(nextBM, true);
  };

  // Restarts playback loop with optional cooldown pauses and countdowns
  const handleRepeatReset = () => {
    if (!playerRef.current) return;

    if (isSequentialPlayActive) {
      playNextSequentialBookmark("forward");
      return;
    }

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
    isInitializingRef.current = true;
    lastVideoLoadedTimeRef.current = Date.now();
    
    playerRef.current = new (window as any).YT.Player("youtube-player-frame", {
      videoId: activeVideoId,
      playerVars: {
        autoplay: 1,
        mute: 1, // Ensure muted autoplay is guaranteed to bypass modern browser autoplay blocking
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
          }

          let localStart = startTime;
          const queryVol = localStorage.getItem("yt_loop_player_volume");
          let targetVolume = queryVol ? parseInt(queryVol, 10) : playerVolume;
          
          if (loadedFromBookmarkRef.current) {
            localStart = loadedFromBookmarkRef.current.startTime;
            setStartTime(loadedFromBookmarkRef.current.startTime);
            setEndTime(loadedFromBookmarkRef.current.endTime);
            setIsStartSet(true);
            setIsEndSet(true);
            if (loadedFromBookmarkRef.current.volume !== undefined) {
              targetVolume = loadedFromBookmarkRef.current.volume;
            }
          } else if (duration && duration > 0) {
            setEndTime(duration);
          }

          setPlayerVolume(targetVolume);
          localStorage.setItem("yt_loop_player_volume", targetVolume.toString());

          // 항상 오토플레이와 브라우저 제한 우회를 위해 우선 mute한 다음 플레이 및 탐색(seekTo) 시그널을 강제로 보내고,
          // 그 뒤 즉각적인 일시정지(pauseVideo) 및 unmute를 실행하여 비디오를 활성화 & 대기 상태로 맞춥니다.
          try {
            if (typeof event.target.mute === "function") {
              event.target.mute();
            }
            event.target.seekTo(localStart, true);
            event.target.playVideo();
          } catch (e) {}

          const shouldKeepPlaying = autoPlayIntentRef.current;

          setTimeout(() => {
            try {
              if (event.target) {
                const savedVol = localStorage.getItem("yt_loop_player_volume");
                const currentVol = savedVol ? parseInt(savedVol, 10) : 100;
                const savedMuted = localStorage.getItem("yt_loop_player_is_muted") === "true";

                if (shouldKeepPlaying) {
                  if (typeof event.target.playVideo === "function") {
                    event.target.playVideo();
                  }
                  if (typeof event.target.seekTo === "function") {
                    event.target.seekTo(localStart, true);
                  }
                  
                  // Restore volume/mute state correctly
                  if (savedMuted) {
                    if (typeof event.target.mute === "function") event.target.mute();
                  } else {
                    if (typeof event.target.unMute === "function") event.target.unMute();
                    if (typeof event.target.setVolume === "function") event.target.setVolume(currentVol);
                  }
                  setIsPlaying(true);
                } else {
                  if (typeof event.target.pauseVideo === "function") {
                    event.target.pauseVideo();
                  }
                  if (typeof event.target.seekTo === "function") {
                    event.target.seekTo(localStart, true);
                  }
                  
                  // Restore volume/mute state correctly
                  if (savedMuted) {
                    if (typeof event.target.mute === "function") event.target.mute();
                  } else {
                    if (typeof event.target.unMute === "function") event.target.unMute();
                    if (typeof event.target.setVolume === "function") event.target.setVolume(currentVol);
                  }
                  setIsPlaying(false);
                }
              }
            } catch (e) {}
            // Clear refs after loading completes
            loadedFromBookmarkRef.current = null;
            autoPlayIntentRef.current = false;
            isInitializingRef.current = false;
          }, 450);
        },
        onStateChange: (event: any) => {
          // YT.PlayerState.PLAYING = 1, PAUSED = 2
          if (event.data === 1) {
            // Apply volume & mute settings robustly on play events
            try {
              const savedMuted = localStorage.getItem("yt_loop_player_is_muted") === "true";
              if (!popoutActive) {
                if (savedMuted) {
                  if (typeof event.target.mute === "function") {
                    event.target.mute();
                  }
                } else {
                  if (typeof event.target.unMute === "function") {
                    event.target.unMute();
                  }
                  const savedVol = localStorage.getItem("yt_loop_player_volume");
                  const currentVol = savedVol ? parseInt(savedVol, 10) : 100;
                  if (typeof event.target.setVolume === "function") {
                    event.target.setVolume(currentVol);
                  }
                }
              }
            } catch (volErr) {}

            if (popoutActive) {
              // 듀얼모니터 전송 중에는 메인 영상이 플레이되는 것을 방지하고, 무조건 오디오를 물리적으로 소거(mute)합니다.
              try {
                event.target.mute();
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
          try {
            updateIframeApiStates();
          } catch (e) {}
        },
        onError: (event: any) => {
          console.warn("YouTube player integration error code:", event.data);
          setIsPlayerReady(true); // dismiss overlay so fallback messages/controls can be seen
          isInitializingRef.current = false;
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
    lastVideoLoadedTimeRef.current = Date.now();
    isInitializingRef.current = true;
    const savedVol = localStorage.getItem("yt_loop_player_volume");
    const currentVol = savedVol ? parseInt(savedVol, 10) : playerVolume;
    setPlayerVolume(currentVol);
    if (playerRef.current && iframeReadyRef.current) {
      try {
        playerRef.current.setVolume(currentVol);
        if (isMuted) {
          playerRef.current.mute();
        } else {
          playerRef.current.unMute();
        }
      } catch (e) {}
    }
    setActiveVideoId(freshId);
    setVideoIdInput("");
    showTemporaryNotification(`유튜브 동영상이 로드되었습니다 ✨ (소리 크기: ${currentVol}%)`);
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

  // Volume handler adjustments
  const changeVolume = (val: number) => {
    const clamped = Math.max(0, Math.min(100, val));
    setPlayerVolume(clamped);
    setIsMuted(false);
    lastVolumeActionTimeRef.current = Date.now();
    localStorage.setItem("yt_loop_player_volume", clamped.toString());
    localStorage.setItem("yt_loop_player_is_muted", "false");
    if (playerRef.current && iframeReadyRef.current) {
      try {
        playerRef.current.setVolume(clamped);
        playerRef.current.unMute();
      } catch (e) {}
    }
  };

  const toggleMute = () => {
    lastVolumeActionTimeRef.current = Date.now();
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    localStorage.setItem("yt_loop_player_is_muted", String(nextMute));

    if (playerRef.current && iframeReadyRef.current) {
      try {
        if (nextMute) {
          playerRef.current.mute();
          showTemporaryNotification("음소거되었습니다 🔇");
        } else {
          playerRef.current.unMute();
          const savedVol = localStorage.getItem("yt_loop_player_volume");
          const vol = savedVol ? parseInt(savedVol, 10) : playerVolume;
          playerRef.current.setVolume(vol);
          showTemporaryNotification(`음소거가 해제되었습니다 🔊 (볼륨: ${vol}%)`);
        }
      } catch (e) {
        console.warn("Mute toggling failed in Iframe:", e);
      }
    } else {
      showTemporaryNotification(nextMute ? "음소거 상태로 예약됨 🔇" : "음소거 해제 상태로 예약됨 🔊");
    }
  };

  // Player Play/Pause toggles
  const handleTogglePlay = () => {
    if (!playerRef.current) return;
    if (popoutActive) {
      // 듀얼모니터 전송 상태일 때도 메인 동영상을 억지 정지하지 않고, 재생 상태 명령만 자연스럽게 상호 미러링시킵니다.
      const nextPlayState = !isPlaying;
      setIsPlaying(nextPlayState);
      
      if (iframeReadyRef.current) {
        try {
          playerRef.current.mute(); // 무중음 미러링 유지
          if (nextPlayState) {
            playerRef.current.playVideo();
          } else {
            playerRef.current.pauseVideo();
          }
        } catch (e) {}
      }
      
      syncPopoutWithParent("sync_state", {
        videoId: activeVideoId,
        startTime,
        endTime,
        loopActive,
        playbackSpeed,
        isPlaying: nextPlayState,
        currentTime: playerRef.current ? playerRef.current.getCurrentTime() : currentTime,
        playerVolume,
        isMuted
      });

      showTemporaryNotification(`[보조 모니터 전송] ${nextPlayState ? "재생" : "일시정지"} 명령 전달 📺`);
      return;
    }

    if (isPlaying) {
      playerRef.current.pauseVideo();
      setIsPlaying(false);
    } else {
      try {
        if (typeof playerRef.current.unMute === "function") {
          playerRef.current.unMute();
        }
        const savedVol = localStorage.getItem("yt_loop_player_volume");
        const currentVol = savedVol ? parseInt(savedVol, 10) : 100;
        if (typeof playerRef.current.setVolume === "function") {
          playerRef.current.setVolume(currentVol);
        }
      } catch (volErr) {}
      playerRef.current.playVideo();
      setIsPlaying(true);
    }
  };

  // 구간 재생 (A-B 반복구간 전용 재생 시작)
  const handleRangePlay = () => {
    if (!playerRef.current || !iframeReadyRef.current) return;
    
    // 구간 기능 사용이 꺼져있다면 명시적으로 활성화
    if (!isRangeEnabled) {
      setIsRangeEnabled(true);
      showTemporaryNotification("구간 기능이 활성화되었습니다 🔁");
    }
    
    try {
      if (typeof playerRef.current.unMute === "function") {
        playerRef.current.unMute();
      }
      const savedVol = localStorage.getItem("yt_loop_player_volume");
      const currentVol = savedVol ? parseInt(savedVol, 10) : 100;
      if (typeof playerRef.current.setVolume === "function") {
        playerRef.current.setVolume(currentVol);
      }
      playerRef.current.seekTo(startTime, true);
      playerRef.current.playVideo();
      setIsPlaying(true);
      showTemporaryNotification(`지정 구간 반복 재생 시작: ${formatTimeAsSeconds(startTime)} 📍`);
    } catch (e) {
      console.warn("구간 재생 에러:", e);
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
        updateStartTime(Math.max(0, Math.min(current, endTime - 0.2)));
        showTemporaryNotification(`구간 시작점 (A) 지정 완료: ${formatTimeAsSeconds(current)} 📍`);
      } else if (key === hotkeys.setEnd) {
        e.preventDefault();
        const current = playerRef.current ? playerRef.current.getCurrentTime() : currentTime;
        updateEndTime(Math.max(startTime + 0.2, Math.min(current, videoMeta.duration)));
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
        updateStartTime(current);
        showTemporaryNotification(`원터치 시작캡처 [S] 성공: ${formatTimeAsSeconds(current)} (여기!)`);
      } else if (key === hotkeys.captureEnd) {
        e.preventDefault();
        const current = playerRef.current ? playerRef.current.getCurrentTime() : currentTime;
        updateEndTime(current);
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

  const handleSelectBookmark = (bm: Bookmark, autoPlay?: boolean) => {
    autoPlayIntentRef.current = !!autoPlay;
    setActiveBookmarkId(bm.id);
    
    // If different video, swap sources first
    if (bm.videoId !== activeVideoId) {
      skipInitialResetRef.current = true;
      loadedFromBookmarkRef.current = { startTime: bm.startTime, endTime: bm.endTime, volume: bm.volume };
      setActiveVideoId(bm.videoId);
    } else {
      loadedFromBookmarkRef.current = null;
    }
    
    // Set parameters
    setStartTime(bm.startTime);
    setEndTime(bm.endTime);
    setIsStartSet(true);
    setIsEndSet(true);
    setLoopActive(true);
    setIsRangeEnabled(true);
    setPlaybackSpeed(bm.speed);

    // Restore saved volume if it exists
    if (bm.volume !== undefined) {
      setPlayerVolume(bm.volume);
      localStorage.setItem("yt_loop_player_volume", bm.volume.toString());
      if (playerRef.current && iframeReadyRef.current) {
        try {
          playerRef.current.setVolume(bm.volume);
          playerRef.current.unMute();
        } catch (e) {}
      }
    }
    
    if (playerRef.current && iframeReadyRef.current) {
      playerRef.current.setPlaybackRate(bm.speed);
    }
    handleSeekToTime(bm.startTime);

    if (playerRef.current && iframeReadyRef.current) {
      try {
        if (autoPlay) {
          try {
            if (typeof playerRef.current.unMute === "function") {
              playerRef.current.unMute();
            }
            const savedVol = localStorage.getItem("yt_loop_player_volume");
            const currentVol = savedVol ? parseInt(savedVol, 10) : 100;
            if (typeof playerRef.current.setVolume === "function") {
              playerRef.current.setVolume(currentVol);
            }
          } catch (volErr) {}
          playerRef.current.playVideo();
          setIsPlaying(true);
        } else {
          playerRef.current.pauseVideo();
          setIsPlaying(false);
        }
      } catch (e) {}
    } else {
      // If player is not initialized yet or loading, respect the intent
      setIsPlaying(!!autoPlay);
    }
    
    showTemporaryNotification(`'${bm.title}' 구간을 원 버튼으로 로드했습니다 ⚡`);
  };

  const handleUpdateBookmark = (id: string, updatedFields: Partial<Bookmark>) => {
    setBookmarks((prev) =>
      prev.map((bm) => (bm.id === id ? { ...bm, ...updatedFields } : bm))
    );
    showTemporaryNotification("구간 정보가 성공적으로 수정되었습니다! 📁");
  };

  const handleToggleBookmarkChecked = (id: string) => {
    setBookmarks((prev) =>
      prev.map((bm) => (bm.id === id ? { ...bm, checked: !(bm.checked ?? true) } : bm))
    );
  };

  const handleMoveBookmarkUp = (id: string) => {
    setBookmarks((prev) => {
      const idx = prev.findIndex((bm) => bm.id === id);
      if (idx <= 0) return prev;
      const copy = [...prev];
      const temp = copy[idx];
      copy[idx] = copy[idx - 1];
      copy[idx - 1] = temp;
      return copy;
    });
  };

  const handleMoveBookmarkDown = (id: string) => {
    setBookmarks((prev) => {
      const idx = prev.findIndex((bm) => bm.id === id);
      if (idx === -1 || idx >= prev.length - 1) return prev;
      const copy = [...prev];
      const temp = copy[idx];
      copy[idx] = copy[idx + 1];
      copy[idx + 1] = temp;
      return copy;
    });
  };

  const handleImportData = (newBms: Bookmark[], newFolders: Folder[]) => {
    if (newBms.length > 0) setBookmarks(newBms);
    if (newFolders.length > 0) setFolders(newFolders);
  };

  const handleQuickAddBookmark = () => {
    if (!activeVideoId) {
      showTemporaryNotification("활성화된 유튜브 동영상이 없습니다 📺");
      return;
    }
    const defaultName = `${videoMeta.title !== "구간 반복을 진행할 유튜브 영상을 불러와 주세요" ? videoMeta.title : "새 반복 구간"} (${formatTimeAsSeconds(startTime)} ~ ${formatTimeAsSeconds(endTime)})`;
    
    handleAddBookmark({
      title: defaultName,
      videoId: activeVideoId,
      videoTitle: videoMeta.title !== "구간 반복을 진행할 유튜브 영상을 불러와 주세요" ? videoMeta.title : undefined,
      channelName: (videoMeta.channelTitle && videoMeta.channelTitle !== "채널명 없음" && videoMeta.channelTitle !== "유튜브 채널 정보") ? videoMeta.channelTitle : undefined,
      startTime,
      endTime,
      speed: playbackSpeed,
      volume: playerVolume,
      notes: "빠른 추가 구간",
      tags: [],
      folderId: ""
    });
  };

  const handleQuickExportBookmarks = () => {
    const dataToExport = {
      bookmarks,
      folders,
      version: "1.0",
      exportDate: Date.now(),
    };
    const blog = new Blob([JSON.stringify(dataToExport, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blog);
    const a = document.createElement("a");
    a.href = url;
    a.download = `youtube_loop_bookmarks_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showTemporaryNotification("구간 백업 파일이 내보내기 되었습니다! 💾");
  };

  const handleQuickImportBookmarks = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
         const json = JSON.parse(evt.target?.result as string);
         if (Array.isArray(json.bookmarks) && Array.isArray(json.folders)) {
           handleImportData(json.bookmarks, json.folders);
           showTemporaryNotification(`백업 로드 완료! (구간: ${json.bookmarks.length}개) 📂`);
         } else if (Array.isArray(json)) {
           handleImportData(json, []);
           showTemporaryNotification(`백업 로드 완료! (구간: ${json.length}개) 📂`);
         } else {
           alert("올바르지 않은 백업 파일 포맷입니다.");
         }
      } catch (err) {
         alert("JSON 파일 파싱 중 오류가 발생했습니다.");
      }
    };
    reader.readAsText(file);
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
                <span>화면 크기 조절</span>
              </div>
              <div className="flex items-center gap-3.5">
                {/* Micro Adjusters with Plus and Minus Buttons */}
                <div className="flex items-center gap-1 bg-slate-950/60 p-0.5 rounded-lg border border-slate-800/60 select-none">
                  <button
                    type="button"
                    onClick={() => setPlayerSize((prev) => Math.max(20, prev - 10))}
                    className="w-5 h-5 rounded hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center font-bold text-[10px] cursor-pointer"
                    title="10% 축소"
                  >
                    －
                  </button>
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider px-1">배율 조절</span>
                  <button
                    type="button"
                    onClick={() => setPlayerSize((prev) => Math.min(100, prev + 10))}
                    className="w-5 h-5 rounded hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center font-bold text-[10px] cursor-pointer"
                    title="10% 확대"
                  >
                    ＋
                  </button>
                </div>

                {/* Preset shortcuts selector */}
                <div className="flex items-center gap-1 bg-slate-950/60 p-0.5 rounded-lg border border-slate-800/60">
                  {[
                    { label: "아주작게 (30%)", val: 30 },
                    { label: "작게 (50%)", val: 50 },
                    { label: "중간 (75%)", val: 75 },
                    { label: "최대 (100%)", val: 100 },
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => setPlayerSize(preset.val)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-all ${
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
                    min="20"
                    max="100"
                    step="5"
                    value={playerSize}
                    onChange={(e) => setPlayerSize(Number(e.target.value))}
                    className="w-full accent-indigo-500 cursor-pointer h-1 bg-slate-800 rounded-lg appearance-none"
                    style={{ background: `linear-gradient(to right, rgb(99, 102, 241) 0%, rgb(99, 102, 241) ${((playerSize - 20) / 80) * 100}%, rgb(30, 41, 59) ${((playerSize - 20) / 80) * 100}%, rgb(30, 41, 59) 100%)` }}
                  />
                  <span className="text-xs font-mono text-indigo-400 font-bold w-9 text-right block">
                    {playerSize}%
                  </span>
                </div>
              </div>
            </div>

            {/* 듀얼 모니터 전송 중 상단 미러링 컨트롤 바 */}
            {activeVideoId && popoutActive && (
              <div className="mx-4 mb-2 mt-2 p-2 bg-indigo-950/80 border border-indigo-500/30 rounded-xl flex items-center justify-between text-[11px] text-indigo-300 select-none animate-pulse">
                <span className="flex items-center gap-1.5 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  듀얼모니터 전송 중 (메인 화면은 소리가 나지 않는 초정밀 송출 컨트롤러 모드입니다.)
                </span>
                <button
                  type="button"
                  onClick={togglePopoutMode}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold cursor-pointer"
                >
                  종료 및 회수 ❌
                </button>
              </div>
            )}

            {/* Embed Video Area */}
            <div className="w-full bg-black relative">
              <div 
                style={{ maxWidth: `${playerSize}%`, margin: "0 auto" }}
                className="aspect-video w-full bg-black relative transition-all duration-200 overflow-hidden" 
                id="youtube-player-container-ref"
              >
                {activeVideoId ? (
                  <div id="youtube-player-frame" className="w-full h-full" />
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
              onChangeStart={updateStartTime}
              onChangeEnd={updateEndTime}
              onSeek={(sec) => {
                handleSeekToTime(sec);
              }}
              videoId={activeVideoId}
              isStartSet={isStartSet}
              isEndSet={isEndSet}
              isRangeEnabled={isRangeEnabled}
            />

            {/* Quick Micro Adjusters for Start & End Ranges */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4 items-stretch">
              
              {/* Range A Set Deck - Now Sound & Playback Speed */}
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-3 flex flex-col justify-between">
                <div>
                  {/* 소리 크기 (볼륨) 슬라이더 */}
                  <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-2.5 mt-2.5 space-y-2">
                    <div 
                      onClick={() => {
                        changeVolume(100);
                        showTemporaryNotification("소리 크기가 100%로 초기화되었습니다 🔊");
                      }}
                      className="flex items-center justify-between text-[10px] text-slate-400 font-bold px-0.5 cursor-pointer hover:text-indigo-300 transition-colors"
                      title="클릭하여 100% 소리 크기로 초기화"
                    >
                      <span className="flex items-center gap-1">🔊 소리 설정 (볼륨)</span>
                      <strong className="text-indigo-400 font-mono bg-indigo-500/10 px-1.5 py-0.5 rounded hover:bg-indigo-500 hover:text-slate-950 transition-all">{playerVolume}%</strong>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={playerVolume}
                        onChange={(e) => changeVolume(parseInt(e.target.value, 10))}
                        className="flex-1 accent-indigo-550 cursor-ew-resize h-1 bg-slate-800 rounded-lg appearance-none block"
                      />
                      <button
                        type="button"
                        onClick={toggleMute}
                        title={isMuted ? "음소거 해제" : "음소거"}
                        className={`p-1.5 rounded-lg border transition-all active:scale-95 cursor-pointer flex items-center justify-center shrink-0 ${
                          isMuted
                            ? "bg-rose-500/20 border-rose-500/40 text-rose-450 hover:bg-rose-500/30"
                            : "bg-slate-950 border-slate-850 hover:bg-slate-900 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {isMuted ? (
                          <VolumeX className="w-3.5 h-3.5" />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* 재생 속도 슬라이더 */}
                  <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-2.5 mt-2.5 space-y-2">
                    <div 
                      onClick={() => {
                        changeSpeedFactor(1.00);
                        showTemporaryNotification("재생 속도가 1.00x로 초기화되었습니다 ⚡");
                      }}
                      className="flex items-center justify-between text-[10px] text-slate-400 font-bold px-0.5 cursor-pointer hover:text-indigo-300 transition-colors"
                      title="클릭하여 1.00x 배속으로 초기화"
                    >
                      <span className="flex items-center gap-1">⚡ 재생 속도</span>
                      <strong className="text-indigo-400 font-mono bg-indigo-500/10 px-1.5 py-0.5 rounded hover:bg-indigo-500 hover:text-slate-950 transition-all">{playbackSpeed.toFixed(2)}x</strong>
                    </div>
                    <input
                      type="range"
                      min="0.25"
                      max="2.00"
                      step="0.05"
                      value={playbackSpeed}
                      onChange={(e) => changeSpeedFactor(parseFloat(e.target.value))}
                      className="w-full accent-indigo-550 cursor-ew-resize h-1 bg-slate-800 rounded-lg appearance-none block"
                    />
                  </div>
                </div>
              </div>

              {/* Middle Playback Video Navigation Deck */}
              <div className="bg-indigo-950/20 p-3 rounded-xl border border-indigo-500/15 flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between border-b border-indigo-500/10 pb-1.5">
                  <span className="text-[11px] font-bold text-indigo-400 flex items-center gap-1">
                    ⚡ 동영상 네비게이션
                  </span>
                  <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-indigo-900/40 text-indigo-300 border border-indigo-700/20">
                    Live CTRL
                  </span>
                </div>

                <div className="flex items-center justify-center gap-2.5 py-1.5 flex-nowrap">
                  {/* 10 seconds back */}
                  <button
                    onClick={() => handleSeekRelative(-10)}
                    type="button"
                    title="10초 뒤로 탐색"
                    className="w-9.5 h-9.5 rounded-full bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-300 transition-all active:scale-90 cursor-pointer flex items-center justify-center shrink-0"
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>

                  {/* Highly polished, very clear and large Play/Pause Circle button */}
                  <button
                    onClick={handleTogglePlay}
                    type="button"
                    title={isPlaying ? "일시정지" : "재생"}
                    className="w-12 h-12 rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white transition-all cursor-pointer flex items-center justify-center shadow-xl shadow-indigo-500/25 active:scale-95 border border-indigo-450 hover:border-white shrink-0"
                  >
                    {isPlaying ? (
                      <Pause className="w-4.5 h-4.5 fill-current text-white" />
                    ) : (
                      <Play className="w-4.5 h-4.5 fill-current text-white ml-0.5" />
                    )}
                  </button>

                  {/* 구간 전용 재생 버튼 (Range Play) - 플레이 오른쪽에 배치 및 텍스트 없음 */}
                  <button
                    onClick={handleRangePlay}
                    disabled={!isRangeEnabled}
                    type="button"
                    title={isRangeEnabled ? "선택한 구간에서만 재생하기 [A-B 반복 재생]" : "구간 기능이 비활성화되어 사용할 수 없습니다"}
                    className={`w-9.5 h-9.5 rounded-full border transition-all active:scale-95 flex items-center justify-center shrink-0 ${
                      isRangeEnabled
                        ? "cursor-pointer bg-emerald-600 border-emerald-400 text-white animate-pulse shadow-lg shadow-emerald-550/20 hover:bg-emerald-550"
                        : "cursor-not-allowed opacity-30 bg-slate-900 border-slate-850 text-slate-500"
                    }`}
                  >
                    <Repeat className="w-4 h-4" />
                  </button>

                  {/* 10 seconds forward */}
                  <button
                    onClick={() => handleSeekRelative(10)}
                    type="button"
                    title="10초 앞으로 탐색"
                    className="w-9.5 h-9.5 rounded-full bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-300 transition-all active:scale-90 cursor-pointer flex items-center justify-center shrink-0"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-center gap-2 pb-1">
                  {/* Frame step backward */}
                  <button
                    onClick={() => handleFrameSeek(false)}
                    type="button"
                    title="1프레임 뒤로 (단축키: ,)"
                    className="flex-1 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:bg-slate-800 text-indigo-400 hover:text-indigo-300 transition-colors flex items-center justify-center gap-1 font-mono text-[10.5px] font-bold"
                  >
                    ◀ 1프레임 뒤로
                  </button>

                  {/* Frame step forward */}
                  <button
                    onClick={() => handleFrameSeek(true)}
                    type="button"
                    title="1프레임 앞으로 (단축키: .)"
                    className="flex-1 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:bg-slate-800 text-indigo-400 hover:text-indigo-300 transition-colors flex items-center justify-center gap-1 font-mono text-[10.5px] font-bold"
                  >
                    1프레임 앞으로 ▶
                  </button>
                </div>
              </div>

              {/* Range B Set Deck - Now Range Activation & repeat loop delay */}
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-3 flex flex-col justify-between">
                <div>
                  {/* 구간 기능 켜기/끄기 토글 버튼 */}
                  <div className="mt-2 select-none">
                    <button
                      onClick={() => {
                        const nextVal = !isRangeEnabled;
                        setIsRangeEnabled(nextVal);
                        showTemporaryNotification(
                          nextVal
                            ? "구간 기능이 활성화되었습니다 🔁 (지정 구간 반복)"
                            : "구간 기능이 비활성화되었습니다 ⏹️ (전체 동영상 재생)"
                        );
                      }}
                      type="button"
                      className={`w-full py-2.5 px-3 rounded-xl text-[11px] font-bold transition-all flex items-center justify-between border cursor-pointer ${
                        isRangeEnabled
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-450 hover:bg-emerald-500/15"
                          : "bg-slate-900/60 border-slate-850 text-slate-500 hover:bg-slate-900 hover:text-slate-350"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full inline-block ${isRangeEnabled ? "bg-emerald-450 animate-pulse" : "bg-slate-700"}`} />
                        <span>구간 기능 사용하기</span>
                      </div>
                      <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded leading-none ${
                        isRangeEnabled ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-800 text-slate-500"
                      }`}>
                        {isRangeEnabled ? "ON" : "OFF"}
                      </span>
                    </button>
                  </div>

                  {/* 구간반복 토글 & 지연 정지 컨트롤 */}
                  <div className="grid grid-cols-2 gap-2 mt-2 select-none font-sans">
                    <button
                      onClick={() => {
                        const nextVal = !loopActive;
                        setLoopActive(nextVal);
                        showTemporaryNotification(
                          nextVal ? "구간 반복 재생이 켜졌습니다 🔁" : "구간 반복 재생이 꺼졌습니다 ⏹️"
                        );
                      }}
                      type="button"
                      className={`h-[38px] px-2 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                        loopActive
                          ? "bg-indigo-600/35 border-indigo-500/50 text-indigo-300 shadow-md ring-1 ring-indigo-500/20"
                          : "bg-slate-900/60 text-slate-450 border-slate-850 hover:border-slate-800 hover:text-slate-350"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full inline-block ${loopActive ? "bg-emerald-400 animate-pulse" : "bg-slate-700"}`} />
                      구간반복 {loopActive ? "켜짐" : "꺼짐"}
                    </button>

                    <div className="flex items-center justify-between bg-slate-900/90 border border-slate-850 px-2 rounded-xl h-[38px]">
                      <span className="text-[10px] text-slate-450 font-bold shrink-0">⏱️ 지연:</span>
                      <select
                        value={cooldownDelay}
                        onChange={(e) => setCooldownDelay(parseInt(e.target.value))}
                        className="bg-transparent border-0 text-amber-450 font-bold focus:outline-none cursor-pointer outline-none font-sans text-[11px] shrink-0 pr-1"
                      >
                        <option value={0} className="bg-slate-950 text-slate-300">없음</option>
                        {Array.from({ length: 10 }, (_, i) => i + 1).map((sec) => (
                          <option key={sec} value={sec} className="bg-slate-950 text-slate-300">
                            {sec}초
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>


                </div>
              </div>

            </div>
          </div>

        </section>

        {/* RIGHT COLUMN (Bookmarks list panel & File configuration manager) */}
        <aside className="lg:col-span-5 xl:col-span-4 bg-slate-950/40 rounded-3xl p-4 border border-slate-800 space-y-4">
          
          {/* 유튜브 동영상 검색 (YouTube Video Search) */}
          <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 space-y-3 transition-all duration-300">
            <div 
              onClick={() => {
                const nextVal = !searchCollapsed;
                setSearchCollapsed(nextVal);
                localStorage.setItem("yt_loop_search_collapsed", String(nextVal));
              }}
              className="flex items-center justify-between cursor-pointer select-none group"
            >
              <h4 className="text-xs font-bold text-indigo-300 flex items-center gap-2 font-display group-hover:text-indigo-200 transition-colors">
                <Search className="w-3.5 h-3.5 text-indigo-400" />
                <span>유튜브 동영상 검색</span>
              </h4>
              <div className="flex items-center gap-2">
                {searchResults.length > 0 && !searchCollapsed && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSearchResults([]);
                      setSearchQuery("");
                    }}
                    className="text-[10px] text-slate-400 hover:text-rose-400 transition-colors font-medium mr-1.5"
                    type="button"
                  >
                    결과 지우기
                  </button>
                )}
                <span className="text-[10px] font-bold text-slate-400 group-hover:text-indigo-300 transition-colors bg-slate-950/80 border border-slate-800 rounded px-1.5 py-0.5 select-none text-[9.5px]">
                  {searchCollapsed ? "원격 검색 펼치기 ＋" : "검색 기능 접기 －"}
                </span>
              </div>
            </div>

            {!searchCollapsed && (
              <div className="space-y-3 pt-1">
                <form onSubmit={handleYoutubeSearch} className="flex gap-1.5">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="검색 키워드 입력..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSearching}
                    className="bg-indigo-650 hover:bg-indigo-550 text-white px-3 py-1.5 rounded-xl font-semibold text-xs transition-colors flex items-center gap-1 disabled:opacity-50 shrink-0 cursor-pointer"
                  >
                    {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-200" /> : <Search className="w-3.5 h-3.5" />}
                    <span>검색</span>
                  </button>
                </form>

                {/* 에러 피드백 */}
                {searchError && (
                  <div className="text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl p-2 font-medium">
                    ⚠️ {searchError}
                  </div>
                )}

                {/* 검색 결과 리스트 */}
                {searchResults.length > 0 && (
                  <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-slate-850">
                    {searchResults.map((item) => {
                      const isCurrent = item.id === activeVideoId;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            loadNewVideo(item.id);
                          }}
                          type="button"
                          className={`w-full p-2 rounded-xl text-left border flex items-start gap-2.5 transition-all text-xs cursor-pointer ${
                            isCurrent
                              ? "bg-indigo-950/40 border-indigo-500/80"
                              : "bg-slate-950/50 hover:bg-slate-950 border-slate-900/60 hover:border-slate-800"
                          }`}
                        >
                          <img
                            src={item.thumbnail}
                            alt=""
                            className="w-16 h-10 object-cover rounded-lg bg-slate-900 border border-slate-850 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <h5 className="font-semibold text-slate-200 line-clamp-2 leading-tight text-[11px]" title={item.title}>
                              {item.title}
                            </h5>
                            <p className="text-[10px] text-indigo-400/80 mt-1 truncate font-mono">
                              📺 {item.channelTitle}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 유튜브 Iframe Player API 실시간 제어 센터 (Official YouTube Iframe Player API Control Panel) */}
          <div className={`bg-slate-900/60 p-4 rounded-2xl border border-slate-800 transition-all duration-300 ${apiCardCollapsed ? "space-y-0" : "space-y-3"}`}>
            <div 
              onClick={() => {
                const nextVal = !apiCardCollapsed;
                setApiCardCollapsed(nextVal);
                localStorage.setItem("yt_loop_api_card_collapsed", String(nextVal));
              }}
              className="flex items-center justify-between cursor-pointer group select-none"
            >
              <h4 className="text-xs font-bold text-amber-400 flex items-center gap-2 font-display">
                <Sliders className="w-4 h-4 text-amber-400 animate-pulse" />
                <span>유튜브 Iframe 플레이어 API 제어 센터</span>
                <span className="text-[8px] bg-amber-500/10 text-amber-300 px-1 py-0.5 rounded uppercase leading-none font-sans font-bold">Official Client API</span>
              </h4>
              <button
                type="button"
                className="text-[10px] text-slate-500 group-hover:text-amber-400 transition-colors font-semibold"
              >
                {apiCardCollapsed ? "펼치기 ＋" : "접기 －"}
              </button>
            </div>

            {!apiCardCollapsed && (
              <>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  브라우저 보안 샌드박스 크로스도메인 CORS 한계를 우회하여, 유튜브 공식 Iframe Player SDK에서 실시간 바인딩 제공하는 오리지널 메타데이터 정보 및 재생 특성을 완벽히 직접 제어합니다.
                </p>

                {!activeVideoId ? (
                  <div className="bg-slate-950/60 border border-slate-900 rounded-xl p-3 text-center text-slate-500 text-[11px] py-4">
                    ⚠️ 상단의 검색이나 링크를 이용해 동영상을 먼저 로드해 주세요.
                  </div>
                ) : (
                  <div className="space-y-4 pt-1">
                    
                    {/* 실시간 플레이어 상태 정보 */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-850/50">
                        <div className="text-[9px] text-slate-500 font-mono mb-0.5">API Player State</div>
                        <div className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            apiPlayerState === 1 ? "bg-emerald-500 animate-ping" : 
                            apiPlayerState === 2 ? "bg-amber-500" :
                            apiPlayerState === 3 ? "bg-orange-500 animate-pulse" :
                            apiPlayerState === 0 ? "bg-slate-500" : "bg-blue-500"
                          }`} />
                          {apiPlayerState === -1 && "시작 안 됨 (-1)"}
                          {apiPlayerState === 0 && "재생 완료 (0)"}
                          {apiPlayerState === 1 && "재생 중 (1)"}
                          {apiPlayerState === 2 && "일시중지 (2)"}
                          {apiPlayerState === 3 && "버퍼링 중 (3)"}
                          {apiPlayerState === 5 && "영상 로드대기 (5)"}
                        </div>
                      </div>

                      <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-850/50">
                        <div className="text-[9px] text-slate-500 font-mono mb-0.5">영상 화질 등급</div>
                        <div className="text-[11px] font-bold text-amber-300 font-sans truncate">
                          {apiCurrentQuality ? apiCurrentQuality.toUpperCase() : "AUTO"}
                        </div>
                      </div>
                    </div>

                    {/* 실시간 소리 (볼륨 및 음소거) API 제어 스테이션 */}
                    <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-850/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-sans font-bold text-slate-300 flex items-center gap-1.5">
                          <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                          <span>Iframe 소리 볼륨 및 음소거 API 제어</span>
                        </span>
                        <span className={`text-[8.5px] font-mono px-1.5 py-0.5 rounded leading-none ${
                          apiIsMuted ? "bg-rose-500/15 text-rose-400" : "bg-emerald-500/15 text-emerald-400"
                        }`}>
                          {apiIsMuted ? "MUTE (음소거됨)" : "SOUND ON"}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            if (!playerRef.current || !iframeReadyRef.current) return;
                            try {
                              const toggleToMuted = !apiIsMuted;
                              if (toggleToMuted) {
                                playerRef.current.mute();
                                setApiIsMuted(true);
                                setIsMuted(true);
                                localStorage.setItem("yt_loop_player_is_muted", "true");
                                showTemporaryNotification(`🔇 API 제어: 음소거 모드로 전환했습니다.`);
                              } else {
                                playerRef.current.unMute();
                                setApiIsMuted(false);
                                setIsMuted(false);
                                localStorage.setItem("yt_loop_player_is_muted", "false");
                                const savedVol = localStorage.getItem("yt_loop_player_volume");
                                const vol = savedVol ? parseInt(savedVol, 10) : playerVolume;
                                playerRef.current.setVolume(vol);
                                showTemporaryNotification(`🔊 API 제어: 음소거를 해제했습니다.`);
                              }
                            } catch (err) {}
                          }}
                          className={`p-1.5 rounded-lg border transition-all text-xs font-semibold flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
                            apiIsMuted 
                              ? "bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border-rose-500/30" 
                              : "bg-slate-900 hover:bg-slate-850 text-slate-300 border-slate-750"
                          }`}
                          title="음소거 토글 API (mute / unMute)"
                        >
                          {apiIsMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                          <span className="text-[9.5px]">{apiIsMuted ? "음소거 해제" : "음소거 적용"}</span>
                        </button>

                        <div className="flex-1 space-y-1">
                          <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                            <span>setVolume({apiVolume})</span>
                            <span className="text-amber-400/90 font-bold">{apiVolume}%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500">0</span>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={apiVolume}
                              onChange={(e) => {
                                const newVol = parseInt(e.target.value, 10);
                                setApiVolume(newVol);
                                setPlayerVolume(newVol);
                                if (playerRef.current && iframeReadyRef.current) {
                                  try {
                                    playerRef.current.setVolume(newVol);
                                    if (apiIsMuted) {
                                      playerRef.current.unMute();
                                      setApiIsMuted(false);
                                      setIsMuted(false);
                                      localStorage.setItem("yt_loop_player_is_muted", "false");
                                    }
                                  } catch (e) {}
                                }
                              }}
                              className="flex-1 accent-amber-500 h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer"
                              style={{ background: `linear-gradient(to right, rgb(245, 158, 11) 0%, rgb(245, 158, 11) ${apiVolume}%, rgb(30, 41, 59) ${apiVolume}%, rgb(30, 41, 59) 100%)` }}
                            />
                            <span className="text-[10px] text-slate-500">100</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-[8.5px] text-slate-550 leading-normal border-t border-slate-850/50 pt-1.5 flex justify-between items-center font-mono">
                        <span>• player.getVolume(): <strong className="text-amber-500">{apiVolume}</strong></span>
                        <span>• player.isMuted(): <strong className={apiIsMuted ? "text-rose-450" : "text-emerald-400"}>{apiIsMuted ? "true" : "false"}</strong></span>
                      </div>
                    </div>

                    {/* 실시간 프리-버퍼링 모니터 */}
                    <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-850/50 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-400 font-sans font-medium">스트림 프리-버퍼링 비율</span>
                        <span className="text-amber-400 font-mono font-bold">{(apiLoadedFraction * 100).toFixed(1)}%</span>
                      </div>
                      <div className="h-2 bg-slate-900 rounded-full overflow-hidden relative border border-slate-800/40">
                        <div 
                          className="h-full bg-gradient-to-r from-amber-600 to-amber-500 transition-all duration-300 rounded-full"
                          style={{ width: `${Math.min(100, apiLoadedFraction * 100)}%` }}
                        />
                      </div>
                      <div className="text-[8.5px] text-slate-500 leading-none">
                        * 플레이어가 다음 섹션을 위해 미리 다운로드(인메모리 캐싱) 완료한 비율입니다.
                      </div>
                    </div>

                    {/* 실시간 강제 화질 지시 제어기 */}
                    <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-850/50 space-y-2">
                      <div className="text-[10px] font-sans font-bold text-slate-300 flex items-center gap-1.5">
                        <Monitor className="w-3.5 h-3.5 text-amber-400" />
                        <span>Iframe 화질(해상도) 강제 변경</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {[
                          { label: "1080P", value: "hd1080" },
                          { label: "720P", value: "hd720" },
                          { label: "480P", value: "large" },
                          { label: "360P", value: "medium" },
                          { label: "240P", value: "small" },
                          { label: "자동", value: "default" }
                        ].map((q) => {
                          const isSelected = apiCurrentQuality === q.value;
                          const isAvailable = apiAvailableQualities.length === 0 || apiAvailableQualities.includes(q.value);
                          return (
                            <button
                              key={q.value}
                              type="button"
                              disabled={!isAvailable}
                              onClick={() => {
                                if (playerRef.current && iframeReadyRef.current) {
                                  try {
                                    playerRef.current.setPlaybackQuality(q.value);
                                    setApiCurrentQuality(q.value);
                                    showTemporaryNotification(`📺 화질을 [${q.label}] 등급으로 지시했습니다.`);
                                  } catch (e) {}
                                }
                              }}
                              className={`text-[9.5px] py-1 rounded-md font-mono font-bold border transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-amber-500/15 border-amber-500/80 text-amber-300 shadow-md shadow-amber-950/25"
                                  : !isAvailable
                                    ? "bg-slate-950/20 border-slate-900/30 text-slate-700 cursor-not-allowed opacity-50"
                                    : "bg-slate-950/50 hover:bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-200"
                              }`}
                              title={!isAvailable ? "해당 유튜브 환경에서 지원되지 않는 해상도입니다." : `${q.label} 화질 강제 지정`}
                            >
                              {q.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 공식 플레이어 자막 트랙 상태 트래커 */}
                    <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-850/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-sans font-bold text-slate-300 flex items-center gap-1.5">
                          <Languages className="w-3.5 h-3.5 text-amber-400" />
                          <span>Iframe 내장 자막 (CC) 컨트롤</span>
                        </span>
                        <span className={`text-[8.5px] font-mono px-1.5 py-0.5 rounded leading-none ${
                          apiCaptionsEnabled ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-850 text-slate-500"
                        }`}>
                          {apiCaptionsEnabled ? "활성화됨" : "비활성화"}
                        </span>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => {
                          if (!playerRef.current || !iframeReadyRef.current) return;
                          try {
                            const nextState = !apiCaptionsEnabled;
                            if (nextState) {
                              // Force load CC module and request Korean subtitles
                              playerRef.current.loadModule("captions");
                              playerRef.current.setOption("captions", "track", { languageCode: "ko" });
                              showTemporaryNotification("💬 플레이어 내장 한국어 자막 탑재를 지시했습니다.");
                            } else {
                              playerRef.current.unloadModule("captions");
                              showTemporaryNotification("❌ 자막 모듈을 언로드 지시했습니다.");
                            }
                            setApiCaptionsEnabled(nextState);
                          } catch (e) {
                            showTemporaryNotification("자막 트랙 조종은 현재 영상의 소스 권한에 의존합니다.");
                          }
                        }}
                        className={`w-full py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          apiCaptionsEnabled
                            ? "bg-emerald-950/30 border-emerald-500/60 text-emerald-400 hover:bg-emerald-950/50"
                            : "bg-slate-950/50 hover:bg-slate-950 border-slate-850 text-slate-300 hover:text-slate-100"
                        }`}
                      >
                        <Languages className="w-3.5 h-3.5" />
                        <span>{apiCaptionsEnabled ? "Iframe 내장 자막 끄기" : "Iframe 내장 한국어 자막 강제 켜기"}</span>
                      </button>
                    </div>

                    {/* 가용한 정밀 배속 탐색기 */}
                    <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-850/50 space-y-2">
                      <div className="text-[10px] font-sans font-bold text-slate-300 flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-amber-400" />
                        <span>지원 배속 직접 탐색 선택 (Supported Rates)</span>
                      </div>
                      
                      <div className="flex flex-wrap gap-1">
                        {(apiAvailableRates.length > 0 ? apiAvailableRates : [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0]).map((rate) => {
                          const isSelected = Math.abs(playbackSpeed - rate) < 0.05;
                          return (
                            <button
                              key={rate}
                              type="button"
                              onClick={() => {
                                setPlaybackSpeed(rate);
                                if (playerRef.current && iframeReadyRef.current && typeof playerRef.current.setPlaybackRate === "function") {
                                  try {
                                    playerRef.current.setPlaybackRate(rate);
                                    showTemporaryNotification(`⚡ 플레이 속도를 ${rate}배속으로 직접 조정했습니다.`);
                                  } catch (e) {}
                                }
                              }}
                              className={`text-[9.5px] px-2 py-1 rounded-md font-mono font-medium border transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-amber-500/15 border-amber-500 text-amber-300"
                                  : "bg-slate-950/50 hover:bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-200"
                              }`}
                            >
                              x{rate}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 플레이어 실시간 디버그 사양 요약 */}
                    <div className="bg-slate-950/40 p-2 rounded-xl text-[9px] text-slate-500 font-mono space-y-1">
                      <div className="flex justify-between">
                        <span>Video ID:</span>
                        <span className="text-slate-400 font-sans">{apiVideoData?.video_id || activeVideoId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Title:</span>
                        <span className="text-slate-400 truncate max-w-[150px] font-sans" title={apiVideoData?.title || videoMeta.title}>
                          {apiVideoData?.title || videoMeta.title}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Channel:</span>
                        <span className="text-slate-400 truncate max-w-[150px] font-sans" title={apiVideoData?.author || videoMeta.channelTitle}>
                          {apiVideoData?.author || videoMeta.channelTitle}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Buffered:</span>
                        <span className="text-slate-400">{(apiLoadedFraction * 100).toFixed(1)}%</span>
                      </div>
                    </div>

                  </div>
                )}
              </>
            )}
          </div>

          {/* AI 스마트 자동 구간 추출 기능 (AI-Assisted Smart Range Slicing) */}
          <div className={`bg-slate-900/60 p-4 rounded-2xl border border-slate-800 transition-all duration-300 ${aiCardCollapsed ? "space-y-0" : "space-y-3"}`}>
            <div 
              onClick={() => {
                const nextVal = !aiCardCollapsed;
                setAiCardCollapsed(nextVal);
                localStorage.setItem("yt_loop_ai_card_collapsed", String(nextVal));
              }}
              className="flex items-center justify-between cursor-pointer group select-none"
            >
              <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-2 font-display">
                <Brain className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span>AI 스마트 자동 구간 추출</span>
                <span className="text-[8px] bg-emerald-500/10 text-emerald-300 px-1 py-0.5 rounded uppercase leading-none font-sans font-bold">Gemini 3.5</span>
              </h4>
              <button
                type="button"
                className="text-[10px] text-slate-500 group-hover:text-emerald-400 transition-colors font-semibold"
              >
                {aiCardCollapsed ? "펼치기 ＋" : "접기 －"}
              </button>
            </div>

            {!aiCardCollapsed && (
              <>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  사용자가 매번 타임코드를 잡지 않아도, AI가 영상의 오디오 스트림과 자막을 분석해 문장별 리핏 칩(STT)을 생성하고, 비전 장면 전환을 감지합니다.
                </p>

                {!activeVideoId ? (
                  <div className="bg-slate-950/60 border border-slate-900 rounded-xl p-3 text-center text-slate-500 text-[11px] py-4">
                    ⚠️ 상단의 검색이나 링크를 이용해 동영상을 먼저 로드해 주세요.
                  </div>
                ) : (
                  <div className="space-y-3 pt-1">
                    {/* 만약 분석하지 않은 상태라면 실행 버튼 표시 */}
                    {!aiAnalysisCache[activeVideoId] && !isAnalyzingVideo && (
                      <button
                        onClick={handleAnalyzeVideo}
                        type="button"
                        className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold text-xs py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/25 cursor-pointer hover:shadow-emerald-950 active:scale-98"
                      >
                        <Cpu className="w-3.5 h-3.5" />
                        <span>Gemini AI 초정밀 자동 분석 시작</span>
                      </button>
                    )}

                    {/* 분석 진행중인 로딩바 피드백 */}
                    {isAnalyzingVideo && (
                      <div className="bg-slate-950/80 border border-emerald-500/20 rounded-xl p-4 space-y-3 text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 h-1 bg-emerald-500 w-full animate-pulse" />
                        <Loader2 className="w-7 h-7 animate-spin text-emerald-400 mx-auto" />
                        <div className="space-y-1">
                          <h5 className="text-[11px] font-bold text-slate-200">AI가 동영상을 실시간 정밀 분석 중...</h5>
                          <p className="text-[9.5px] text-slate-500 animate-pulse font-mono">
                            [1/3] 음성 인식 및 문장 단위 분할 매핑 중
                          </p>
                          <p className="text-[9px] text-slate-600 select-none">
                            잠시만 기다려 주시면 의미 있는 대화 단위와 컷 전환을 매핑합니다.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* 분석 완료되었을 때 결과 목록 노출 */}
                    {aiAnalysisCache[activeVideoId] && (
                      <div className="space-y-3">
                        {/* 정보 카드 */}
                        <div className="flex items-center justify-between bg-slate-950/80 border border-slate-850 px-2.5 py-1.5 rounded-xl text-[10px]">
                          <span className="text-slate-400 font-medium flex items-center gap-1.5 truncate pr-2">
                            <Sparkles className="w-3 h-3 text-emerald-400 shrink-0" />
                            주제 분류: <strong className="text-emerald-300 font-sans truncate">{aiAnalysisCache[activeVideoId].topic}</strong>
                          </span>
                          <button
                            onClick={handleAnalyzeVideo}
                            className="text-[9px] text-slate-500 hover:text-indigo-400 transition-colors underline bg-transparent border-0 cursor-pointer shrink-0"
                            type="button"
                            title="클릭 시 다시 분석을 요청합니다."
                          >
                            재분석
                          </button>
                        </div>

                        {/* Tab Navigation */}
                        <div className="flex border-b border-slate-850 text-xs">
                          <button
                            onClick={() => setAnalysisTab("speech")}
                            type="button"
                            className={`flex-1 pb-1.5 font-bold transition-all border-b-2 text-center text-[11px] cursor-pointer ${
                              analysisTab === "speech"
                                ? "text-emerald-400 border-emerald-500"
                                : "text-slate-500 border-transparent hover:text-slate-300"
                            }`}
                          >
                            <span className="flex items-center justify-center gap-1 py-0.5">
                              <Languages className="w-3.5 h-3.5" />
                              문장 슬라이싱 ({aiAnalysisCache[activeVideoId].sentences?.length || 0})
                            </span>
                          </button>
                          <button
                            onClick={() => setAnalysisTab("vision")}
                            type="button"
                            className={`flex-1 pb-1.5 font-bold transition-all border-b-2 text-center text-[11px] cursor-pointer ${
                              analysisTab === "vision"
                                ? "text-emerald-400 border-emerald-500"
                                : "text-slate-500 border-transparent hover:text-slate-300"
                            }`}
                          >
                            <span className="flex items-center justify-center gap-1 py-0.5">
                              <Eye className="w-3.5 h-3.5" />
                              장면 감지 ({aiAnalysisCache[activeVideoId].scenes?.length || 0})
                            </span>
                          </button>
                        </div>

                        {/* Tab Content 1: Speech-to-Text sentence chips list */}
                        {analysisTab === "speech" && (
                          <div className="space-y-1.5">
                            <p className="text-[9.5px] text-slate-500 leading-normal mb-1">
                              💡 문장 칩을 <strong>클릭</strong>하면 그 말하는 시작 시점으로 즉시 이동하며, <strong>구간 반복 기능은 자동으로 꺼집니다</strong>.
                            </p>
                            <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-850">
                              {aiAnalysisCache[activeVideoId].sentences?.map((s, idx) => {
                                const isCurrentlyPlaying = (currentTime >= s.startTime && currentTime <= s.endTime);
                                return (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => {
                                      setIsRangeEnabled(false);
                                      setLoopActive(false);
                                      handleSeekToTime(s.startTime);
                                      if (playerRef.current && iframeReadyRef.current) {
                                        try {
                                          playerRef.current.playVideo();
                                          setIsPlaying(true);
                                        } catch(e){}
                                      }
                                      showTemporaryNotification(`📍 문장 시점으로 점프 (구간반복 꺼짐)`);
                                    }}
                                    className={`text-[10px] text-left p-2 rounded-lg border transition-all cursor-pointer w-full relative ${
                                      isCurrentlyPlaying
                                        ? "bg-emerald-950/20 border-emerald-500/85 text-emerald-300 ring-1 ring-emerald-500/20 shadow-md shadow-emerald-950/20"
                                        : "bg-slate-950/60 hover:bg-slate-950 border-slate-850 text-slate-300 hover:text-slate-200 hover:border-slate-800"
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-1.5 mb-1 text-[9.5px] select-none">
                                      <span className="font-mono text-emerald-400 font-bold bg-emerald-500/15 px-1.5 py-0.5 rounded leading-none">
                                        {formatTimeAsSeconds(s.startTime)} ~ {formatTimeAsSeconds(s.endTime)}
                                      </span>
                                      {isCurrentlyPlaying && (
                                        <span className="text-[8px] font-sans font-bold text-emerald-300 animate-pulse bg-emerald-500/10 px-1 py-0.5 rounded uppercase leading-none shrink-0">
                                          🔊 재생 중
                                        </span>
                                      )}
                                      <span className="text-slate-500 text-[8px] font-mono shrink-0">#{idx + 1}</span>
                                    </div>
                                    <div className="leading-relaxed text-[10px] break-all">{s.text}</div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Tab Content 2: Computer vision chapters/slide change list */}
                        {analysisTab === "vision" && (
                          <div className="space-y-1.5">
                            <p className="text-[9.5px] text-slate-500 leading-normal mb-1">
                              💡 클릭하면 <strong>해당 장면 시각으로 즉시 이동</strong>하고, <strong>구간 반복 기능은 자동으로 꺼집니다</strong>.
                            </p>
                            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-850">
                              {aiAnalysisCache[activeVideoId].scenes?.map((sc, idx) => {
                                const isHighlighted = (Math.abs(currentTime - sc.time) <= 1.5);
                                return (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => {
                                      setIsRangeEnabled(false);
                                      setLoopActive(false);
                                      handleSeekToTime(sc.time);
                                      if (playerRef.current && iframeReadyRef.current) {
                                        try {
                                          playerRef.current.playVideo();
                                          setIsPlaying(true);
                                        } catch(e){}
                                      }
                                      showTemporaryNotification(`📍 장면 감지 점프 (구간반복 꺼짐)`);
                                    }}
                                    className={`w-full p-2 text-left rounded-lg border text-xs flex items-start gap-2.5 cursor-pointer transition-all ${
                                      isHighlighted
                                        ? "bg-slate-900 border-amber-500"
                                        : "bg-slate-950/60 hover:bg-slate-950 border-slate-850 hover:border-slate-800"
                                    }`}
                                  >
                                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded leading-none shrink-0 mt-0.5 ${
                                      isHighlighted ? "bg-amber-500/20 text-amber-300" : "bg-slate-800 text-slate-400"
                                    }`}>
                                      {formatTimeAsSeconds(sc.time)}
                                    </span>
                                    <div className="min-w-0 flex-1 space-y-0.5">
                                      <div className="font-bold text-[10.5px] text-slate-200 truncate">{sc.chapterName}</div>
                                      <div className="text-[9px] text-slate-450 line-clamp-2 leading-normal">{sc.description}</div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {aiAnalysisCache[activeVideoId]?.note && (
                          <p className="text-[8.5px] text-amber-400/80 italic text-center mt-1 select-none leading-normal">
                            ℹ️ {aiAnalysisCache[activeVideoId].note}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <BookmarkManager
            bookmarks={bookmarks}
            folders={folders}
            currentVideoId={activeVideoId}
            currentVideoTitle={activeVideoId ? videoMeta.title : undefined}
            currentChannelName={activeVideoId && videoMeta.channelTitle !== "채널명 없음" && videoMeta.channelTitle !== "유튜브 채널 정보" ? videoMeta.channelTitle : undefined}
            currentA={startTime}
            currentB={endTime}
            currentSpeed={playbackSpeed}
            currentVolume={playerVolume}
            activeBookmarkId={activeBookmarkId}
            isSequentialPlayActive={isSequentialPlayActive}
            onToggleSequentialPlay={() => setIsSequentialPlayActive((prev) => !prev)}
            onToggleBookmarkChecked={handleToggleBookmarkChecked}
            onMoveBookmarkUp={handleMoveBookmarkUp}
            onMoveBookmarkDown={handleMoveBookmarkDown}
            onPlayNext={() => playNextSequentialBookmark("forward")}
            onPlayPrev={() => playNextSequentialBookmark("backward")}
            onAddBookmark={handleAddBookmark}
            onDeleteBookmark={handleDeleteBookmark}
            onAddFolder={handleAddFolder}
            onDeleteFolder={handleDeleteFolder}
            onSelectBookmark={handleSelectBookmark}
            onUpdateBookmark={handleUpdateBookmark}
            onImportData={handleImportData}
          />

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
