import React, { useEffect, useRef, useState } from "react";
import { Play, Pause, Minimize2, Maximize2, Monitor, RotateCw, Volume2, Sparkles } from "lucide-react";

interface SyncStateData {
  videoId: string;
  startTime: number;
  endTime: number;
  loopActive: boolean;
  playbackSpeed: number;
  isPlaying: boolean;
  currentTime: number;
}

export function PopoutPlayerView() {
  const [videoId, setVideoId] = useState("");
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(10);
  const [loopActive, setLoopActive] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("대기 중...");

  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeReadyRef = useRef<boolean>(false);
  const loopIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize video settings from query parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const vId = params.get("videoId") || "H6J_RZZqG9E";
    const sTime = parseFloat(params.get("startTime") || "0");
    const eTime = parseFloat(params.get("endTime") || "300");
    const speed = parseFloat(params.get("speed") || "1.0");

    setVideoId(vId);
    setStartTime(sTime);
    setEndTime(eTime);
    setPlaybackSpeed(speed);
  }, []);

  // Set up synchronization listener (both message and storage for ultra robustness)
  useEffect(() => {
    // 1. Direct message sync from opener tab/frame
    const handleMessage = (e: MessageEvent) => {
      const { action } = e.data;
      if (!action) return;

      setConnectionStatus("동기화 연결됨 🟢");

      if (action === "sync_state") {
        const state: SyncStateData = e.data;
        if (state.videoId && state.videoId !== videoId) {
          setVideoId(state.videoId);
        }
        setStartTime(state.startTime);
        setEndTime(state.endTime);
        setLoopActive(state.loopActive);
        setPlaybackSpeed(state.playbackSpeed);
        
        // Sync player playback rate
        if (playerRef.current && iframeReadyRef.current) {
          playerRef.current.setPlaybackRate(state.playbackSpeed);
          
          // Pause/Play sync
          if (state.isPlaying && playerRef.current.getPlayerState() !== 1) {
            playerRef.current.playVideo();
          } else if (!state.isPlaying && playerRef.current.getPlayerState() === 1) {
            playerRef.current.pauseVideo();
          }
        }
      } else if (action === "seek") {
        const dest = parseFloat(e.data.currentTime);
        if (playerRef.current && iframeReadyRef.current && !isNaN(dest)) {
          playerRef.current.seekTo(dest, true);
          setCurrentTime(dest);
        }
      } else if (action === "play_pause") {
        if (playerRef.current && iframeReadyRef.current) {
          const state = playerRef.current.getPlayerState();
          if (state === 1) {
            playerRef.current.pauseVideo();
          } else {
            playerRef.current.playVideo();
          }
        }
      }
    };

    // 2. Cross-tab storage fallback sync
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === "yt_loop_sync" && e.newValue) {
        try {
          const { action, data } = JSON.parse(e.newValue);
          setConnectionStatus("스토리지 동기화 중 🟢");

          if (action === "sync_state") {
            if (data.videoId && data.videoId !== videoId) {
              setVideoId(data.videoId);
            }
            setStartTime(data.startTime);
            setEndTime(data.endTime);
            setLoopActive(data.loopActive);
            setPlaybackSpeed(data.playbackSpeed);
            
            if (playerRef.current && iframeReadyRef.current) {
              playerRef.current.setPlaybackRate(data.playbackSpeed);
              if (data.isPlaying) playerRef.current.playVideo();
              else playerRef.current.pauseVideo();
            }
          } else if (action === "seek") {
            if (playerRef.current && iframeReadyRef.current) {
              playerRef.current.seekTo(data.currentTime, true);
              setCurrentTime(data.currentTime);
            }
          }
        } catch (e) {}
      }
    };

    window.addEventListener("message", handleMessage);
    window.addEventListener("storage", handleStorageEvent);

    // Alert initiator opener that the popup has loaded successfully
    if (window.opener) {
      window.opener.postMessage({ status: "popout_ready" }, "*");
    }

    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("storage", handleStorageEvent);
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ action: "popout_closed" }, "*");
      }
    };
  }, [videoId]);

  // Load Youtube Iframe API script inside popup context
  useEffect(() => {
    if (!videoId) return;

    // Destroy existing player if any
    if (playerRef.current) {
      try {
        playerRef.current.destroy();
      } catch (e) {}
      playerRef.current = null;
    }

    // Initialize player
    const initPlayer = () => {
      if (!(window as any).YT) return;
      playerRef.current = new (window as any).YT.Player("youtube-popout-frame", {
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          controls: 0, // borderless clean cinematic viewport
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onReady: (event: any) => {
            iframeReadyRef.current = true;
            event.target.setPlaybackRate(playbackSpeed);
            
            // 영상을 즉시 플레이하여 반응 준비 상태로 만든 뒤 정지(Pause)시켜 대기함
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
            if (event.data === 1) setIsPlaying(true);
            else setIsPlaying(false);
          },
        },
      });
    };

    if (!(window as any).YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
      (window as any).onYouTubeIframeAPIReady = initPlayer;
    } else {
      initPlayer();
    }
  }, [videoId]);

  // Setup separate loop intervals inside the popup for maximum responsive timing accuracy
  useEffect(() => {
    if (loopIntervalRef.current) clearInterval(loopIntervalRef.current);

    loopIntervalRef.current = setInterval(() => {
      if (!playerRef.current || !iframeReadyRef.current) return;
      try {
        const time = playerRef.current.getCurrentTime();
        if (typeof time === "number" && !isNaN(time)) {
          setCurrentTime(time);

          // 부모(opener)창에 실시간 재생 시간 및 상태 넘기기
          if (window.opener && !window.opener.closed) {
            try {
              const playerState = playerRef.current.getPlayerState();
              const currentIsPlaying = (playerState === 1); // 1 = PLAYING
              window.opener.postMessage({
                action: "popout_time_update",
                currentTime: time,
                isPlaying: currentIsPlaying
              }, "*");
            } catch (err) {}
          }

          if (loopActive && time >= endTime) {
            playerRef.current.seekTo(startTime, true);
            setCurrentTime(startTime);
          }
        }
      } catch (err) {}
    }, 150);

    return () => {
      if (loopIntervalRef.current) clearInterval(loopIntervalRef.current);
    };
  }, [startTime, endTime, loopActive]);

  // Request fullscreen toggle on the container element
  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        alert("전체화면 전환 중 오류가 발생했습니다: " + err.message);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  };

  // Adjust fullscreen listener for Esc clicks
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 10);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms}`;
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black text-white flex flex-col justify-between select-none overflow-hidden font-sans"
      id="popout-viewport-root"
    >
      {/* 1. Header hud overlay (auto-hides in pure presentation or styled beautifully) */}
      <div className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/85 via-black/40 to-transparent p-4 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center animate-pulse">
            <Monitor className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h2 className="text-xs font-bold font-display tracking-tight text-white flex items-center gap-1.5">
              분리형 보조 플레이어 윈도우
              <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full font-mono">
                {connectionStatus}
              </span>
            </h2>
            <p className="text-[9px] text-slate-300">이 창을 서브 모니터로 드래그한 다음 전체화면을 켜세요.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={toggleFullscreen}
            type="button"
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold px-3.5 py-1.5 rounded-lg border border-indigo-400/20 text-white transition-all shadow-md shadow-indigo-600/10"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            {isFullscreen ? "전체화면 종료 (Esc)" : "보조모니터 전체화면 켜기"}
          </button>
        </div>
      </div>

      {/* 2. Absolute Centered Cinematic Iframe Container (Full screen) */}
      <div className="w-full h-full flex items-center justify-center bg-black relative" id="popout-frame-container">
        <div id="youtube-popout-frame" className="w-full h-full pointer-events-none" />
        
        {/* Double click trigger layer for fullscreen convenience */}
        <div 
          className="absolute inset-0 z-10 cursor-pointer" 
          onDoubleClick={toggleFullscreen}
          title="더블 클릭 시 전체화면으로 전환합니다."
        />
      </div>

      {/* 3. Bottom HUD stats layer (Transparent clean look) */}
      <div className="absolute bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-black/90 via-black/45 to-transparent p-4 flex flex-col sm:flex-row justify-between items-center gap-2 border-t border-white/5 pointer-events-none text-xs font-mono text-slate-300">
        <div className="flex items-center gap-4">
          <span>현재 시점: <strong className="text-sky-300 font-bold text-sm">{formatTime(currentTime)}</strong></span>
          <span className="text-slate-500">|</span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            구간 시작 A: <strong className="text-emerald-400">{formatTime(startTime)}</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            구간 종료 B: <strong className="text-rose-400">{formatTime(endTime)}</strong>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="bg-slate-900/80 px-2 py-0.5 rounded border border-white/10 text-[10px]">
             반복 설정: <strong className="text-indigo-450">{loopActive ? 'ON' : 'OFF'}</strong>
          </span>
          <span className="bg-slate-900/80 px-2 py-0.5 rounded border border-white/10 text-[10px]">
             학습속도: <strong className="text-amber-450">{playbackSpeed.toFixed(2)}x</strong>
          </span>
        </div>
      </div>

    </div>
  );
}
