import React, { useState, useEffect, useRef } from "react";
import { Bookmark, Folder, HotkeyConfig, VideoMetadata, DEFAULT_HOTKEYS } from "./types";
import { WaveformTimeline } from "./components/WaveformTimeline";
import { HotkeySettings } from "./components/HotkeySettings";
import { BookmarkManager } from "./components/BookmarkManager";
import { 
  Play, Pause, Square, RotateCw, SkipBack, SkipForward, Flame, Keyboard, Info, Check, AlertCircle,
  HelpCircle, Sparkles, Sliders, Volume2, Globe, Music, GraduationCap, Monitor, Search, Loader2,
  Plus, Download, Upload
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
  const skipInitialResetRef = useRef<boolean>(false);
  const loadedFromBookmarkRef = useRef<{ startTime: number; endTime: number } | null>(null);
  const autoPlayIntentRef = useRef<boolean>(false);

  // --- Popout Mode Management for Second Monitor Fullscreen ---
  const popoutWindowRef = useRef<Window | null>(null);
  const [popoutActive, setPopoutActive] = useState(false);
  const [playerSize, setPlayerSize] = useState<number>(100); // Main video player size percent (50% to 100%)
  const [isPlayerReady, setIsPlayerReady] = useState(false);

  // --- YouTube Search States ---
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchCollapsed, setSearchCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem("yt_loop_search_collapsed");
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
        if (popoutActive) {
          // 팝업 활성화 시 메인 비디오는 절대 작동하지 않고 pause 강제 유지
          try {
            if (typeof playerRef.current.getPlayerState === "function" && playerRef.current.getPlayerState() === 1) {
              playerRef.current.pauseVideo();
            }
          } catch (e) {}
          return; // 메인 타이머 폴러는 중지하고 팝업 메세지를 수신 대기함
        }

        // Sync volume levels bidirectionally in real-time
        if (typeof playerRef.current.getVolume === "function") {
          let currentVol = playerRef.current.getVolume();
          if (typeof playerRef.current.isMuted === "function" && playerRef.current.isMuted()) {
            currentVol = 0;
          }
          if (typeof currentVol === "number" && currentVol !== playerVolume) {
            setPlayerVolume(currentVol);
            localStorage.setItem("yt_loop_player_volume", currentVol.toString());
          }
        }

        // Grab precise timestamp directly from Youtube player Iframe API
        const time = playerRef.current.getCurrentTime();
        if (typeof time === "number" && !isNaN(time)) {
          setCurrentTime(time);

          // Loop repeat check bounding (only if range function is enabled)
          if (isRangeEnabled && loopActive && isEndSet && time >= endTime) {
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
  }, [startTime, endTime, loopActive, isRangeEnabled, isCooldownActive, cooldownDelay, countdownIntro, popoutActive, playerVolume]);

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
          }

          let localStart = startTime;
          if (loadedFromBookmarkRef.current) {
            localStart = loadedFromBookmarkRef.current.startTime;
            setStartTime(loadedFromBookmarkRef.current.startTime);
            setEndTime(loadedFromBookmarkRef.current.endTime);
            setIsStartSet(true);
            setIsEndSet(true);
          } else if (duration && duration > 0) {
            setEndTime(duration);
          }

          // 항상 오토플레이를 구현하기 위해 우선 mute한 다음 플레이 및 탐색(seekTo) 시그널을 강제로 보내고,
          // 그 뒤 즉각적인 일시정지(pauseVideo) 및 unmute를 실행하여 비디오를 활성화 & 대기 상태로 맞춥니다.
          try {
            event.target.mute();
            event.target.seekTo(localStart, true);
            event.target.playVideo();
          } catch (e) {}

          const shouldKeepPlaying = autoPlayIntentRef.current;

          setTimeout(() => {
            try {
              if (event.target) {
                if (shouldKeepPlaying) {
                  if (typeof event.target.playVideo === "function") {
                    event.target.playVideo();
                  }
                  if (typeof event.target.seekTo === "function") {
                    event.target.seekTo(localStart, true);
                  }
                  if (typeof event.target.unmute === "function") {
                    event.target.unmute();
                  }
                  if (typeof event.target.setVolume === "function") {
                    event.target.setVolume(playerVolume);
                  }
                  setIsPlaying(true);
                } else {
                  if (typeof event.target.pauseVideo === "function") {
                    event.target.pauseVideo();
                  }
                  if (typeof event.target.seekTo === "function") {
                    event.target.seekTo(localStart, true);
                  }
                  if (typeof event.target.unmute === "function") {
                    event.target.unmute();
                  }
                  if (typeof event.target.setVolume === "function") {
                    event.target.setVolume(playerVolume);
                  }
                  setIsPlaying(false);
                }
              }
            } catch (e) {}
            // Clear refs after loading completes
            loadedFromBookmarkRef.current = null;
            autoPlayIntentRef.current = false;
          }, 450);
        },
        onStateChange: (event: any) => {
          // YT.PlayerState.PLAYING = 1, PAUSED = 2
          if (event.data === 1) {
            // Apply volume & mute settings robustly on play events
            try {
              if (typeof event.target.unmute === "function") {
                event.target.unmute();
              }
              if (typeof event.target.setVolume === "function") {
                event.target.setVolume(playerVolume);
              }
            } catch (volErr) {}

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
    setPlayerVolume(100);
    localStorage.setItem("yt_loop_player_volume", "100");
    if (playerRef.current && iframeReadyRef.current) {
      try {
        playerRef.current.setVolume(100);
        playerRef.current.unmute();
      } catch (e) {}
    }
    setActiveVideoId(freshId);
    setVideoIdInput("");
    showTemporaryNotification("유튜브 동영상이 로드되었습니다 ✨ (소리 크기가 최대 100%로 설정됨 🔊)");
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
    localStorage.setItem("yt_loop_player_volume", clamped.toString());
    if (playerRef.current && iframeReadyRef.current) {
      try {
        playerRef.current.setVolume(clamped);
        playerRef.current.unmute();
      } catch (e) {}
    }
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
      loadedFromBookmarkRef.current = { startTime: bm.startTime, endTime: bm.endTime };
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
          playerRef.current.unmute();
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
                <span>메인 동영상 화면 크기 조절</span>
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
                      className="mt-4 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-555 text-white rounded-lg text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
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
              onChangeStart={updateStartTime}
              onChangeEnd={updateEndTime}
              onSeek={(sec) => {
                handleSeekToTime(sec);
              }}
              videoId={activeVideoId}
              isStartSet={isStartSet}
              isEndSet={isEndSet}
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
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={playerVolume}
                      onChange={(e) => changeVolume(parseInt(e.target.value, 10))}
                      className="w-full accent-indigo-550 cursor-ew-resize h-1 bg-slate-800 rounded-lg appearance-none block"
                    />
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

                <div className="flex items-center justify-center gap-4 py-1.5">
                  {/* 10 seconds back */}
                  <button
                    onClick={() => handleSeekRelative(-10)}
                    type="button"
                    title="10초 뒤로 탐색"
                    className="p-3 rounded-full bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-300 transition-all active:scale-90 cursor-pointer"
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>

                  {/* Highly polished, very clear and large Play/Pause Circle button */}
                  <button
                    onClick={handleTogglePlay}
                    type="button"
                    title={isPlaying ? "일시정지" : "재생"}
                    className="w-14 h-14 rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white transition-all cursor-pointer flex items-center justify-center shadow-xl shadow-indigo-500/25 active:scale-95 border border-indigo-450 hover:border-white"
                  >
                    {isPlaying ? (
                      <Pause className="w-5 h-5 fill-current text-white" />
                    ) : (
                      <Play className="w-5 h-5 fill-current text-white ml-0.5" />
                    )}
                  </button>

                  {/* 10 seconds forward */}
                  <button
                    onClick={() => handleSeekRelative(10)}
                    type="button"
                    title="10초 앞으로 탐색"
                    className="p-3 rounded-full bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-300 transition-all active:scale-90 cursor-pointer"
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
