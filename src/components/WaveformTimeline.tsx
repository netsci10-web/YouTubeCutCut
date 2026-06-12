import React, { useRef, useEffect, useState } from "react";

interface WaveformTimelineProps {
  duration: number;
  currentTime: number;
  startTime: number;
  endTime: number;
  onChangeStart: (val: number) => void;
  onChangeEnd: (val: number) => void;
  onSeek: (val: number) => void;
  videoId: string;
  isStartSet?: boolean;
  isEndSet?: boolean;
}

export function WaveformTimeline({
  duration,
  currentTime,
  startTime,
  endTime,
  onChangeStart,
  onChangeEnd,
  onSeek,
  videoId,
  isStartSet = true,
  isEndSet = true,
}: WaveformTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragTarget, setDragTarget] = useState<"start" | "end" | "seek" | null>(null);
  const [waves, setWaves] = useState<number[]>([]);

  // Generate deterministic wave visual peaks for the loaded Youtube Video ID
  useEffect(() => {
    if (!videoId) return;
    let hash = 0;
    for (let i = 0; i < videoId.length; i++) {
      hash = videoId.charCodeAt(i) + ((hash << 5) - hash);
    }

    const seededRandom = () => {
      const x = Math.sin(hash++) * 10000;
      return x - Math.floor(x);
    };

    const count = 160;
    const items: number[] = [];
    let prev = 0.4;
    for (let i = 0; i < count; i++) {
      // Create word-like clumps (simulating sentence speech volume)
      const isWordPattern = Math.sin((i / count) * Math.PI * 12) > -0.2;
      const noise = seededRandom() * 0.35 + 0.05;
      const walk = prev + (seededRandom() * 0.25 - 0.125);
      
      let val = walk * (isWordPattern ? 1.0 : 0.2) + noise * 0.2;
      val = Math.max(0.08, Math.min(0.95, val));
      
      // Decay boundaries slightly
      if (i < 5 || i > count - 5) {
        val = val * 0.3;
      }
      
      prev = val;
      items.push(val);
    }
    setWaves(items);
  }, [videoId]);

  // Convert client coordinate to seconds
  const getSecondsFromEvent = (e: React.MouseEvent | MouseEvent): number => {
    if (!containerRef.current || duration <= 0) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    return (x / rect.width) * duration;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current || duration <= 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const totalWidth = rect.width;

    const clickPct = clickX / totalWidth;
    const clickSeconds = clickPct * duration;

    const startPct = startTime / duration;
    const endPct = endTime / duration;

    const startX = startPct * totalWidth;
    const endX = endPct * totalWidth;

    // Check handle tolerance (12px on either side)
    const tolerance = 12;
    if (Math.abs(clickX - startX) <= tolerance) {
      setDragTarget("start");
    } else if (Math.abs(clickX - endX) <= tolerance) {
      setDragTarget("end");
    } else {
      setDragTarget("seek");
      onSeek(clickSeconds);
    }

    e.preventDefault();
  };

  useEffect(() => {
    if (dragTarget === null) return;

    const handleMouseMove = (e: MouseEvent) => {
      const seconds = getSecondsFromEvent(e);
      if (dragTarget === "start") {
        // Clamp A so it cannot exceed B (keep 0.1s minimum gap)
        const val = Math.max(0, Math.min(seconds, endTime - 0.2));
        onChangeStart(val);
      } else if (dragTarget === "end") {
        // Clamp B so it cannot go below A (keep 0.1s minimum gap)
        const val = Math.max(startTime + 0.2, Math.min(seconds, duration));
        onChangeEnd(val);
      } else if (dragTarget === "seek") {
        onSeek(Math.max(0, Math.min(seconds, duration)));
      }
    };

    const handleMouseUp = () => {
      setDragTarget(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragTarget, startTime, endTime, duration, onChangeStart, onChangeEnd, onSeek]);

  // Format second timestamps nicely (MM:SS)
  const formatTime = (sec: number) => {
    const s = Math.max(0, sec);
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 10);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms}`;
  };

  const startPct = duration > 0 ? (startTime / duration) * 100 : 0;
  const endPct = duration > 0 ? (endTime / duration) * 100 : 100;
  const currentPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="w-full select-none mt-2">
      {/* Visual coordinates metadata */}
      <div className="flex justify-between items-center text-xs text-slate-400 font-mono mb-2 px-1 gap-4 flex-wrap sm:flex-nowrap">
        {/* 시작지점 (A)와 미세조정 */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onChangeStart(Math.max(0, Math.min(currentTime, endTime - 0.2)));
            }}
            type="button"
            title="현재 재생 위치를 시작지점(A)으로 지정 [단축키: Q]"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900/80 hover:bg-emerald-500/10 active:scale-95 border border-slate-800 hover:border-emerald-500/30 text-slate-300 transition-all cursor-pointer font-sans h-9"
          >
            <span className={`w-2 h-2 rounded-full ring-2 ring-emerald-950 inline-block ${isStartSet ? "bg-emerald-500" : "bg-slate-600 animate-pulse"}`}></span>
            <span className="text-slate-300 font-semibold text-xs text-[11px]">시작지점 (A):</span>
            <strong className={`font-mono text-xs ${isStartSet ? "text-emerald-400" : "text-slate-550"} text-[11px]`}>
              {isStartSet ? formatTime(startTime) : "지정하기"}
            </strong>
          </button>
          
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onChangeStart(Math.max(0, startTime - 1));
              }}
              type="button"
              className="px-2 py-1.5 text-[10.5px] font-bold bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-xl text-slate-300 font-mono h-9 transition-colors flex items-center justify-center cursor-pointer select-none"
              title="시작 시점 1초 앞으로 당기기"
            >
              -1s
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onChangeStart(Math.min(endTime - 0.2, startTime + 1));
              }}
              type="button"
              className="px-2 py-1.5 text-[10.5px] font-bold bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-xl text-slate-300 font-mono h-9 transition-colors flex items-center justify-center cursor-pointer select-none"
              title="시작 시점 1초 뒤로 미루기"
            >
              +1s
            </button>
          </div>
        </div>

        <span className="text-slate-400 font-sans text-xs bg-slate-950/40 border border-slate-900 px-3 py-1.5 rounded-xl h-9 flex items-center shrink-0">
          현재: <strong className="text-sky-300 font-mono font-bold ml-1">{formatTime(currentTime)}</strong>
        </span>

        {/* 종료지점 (B)와 미세조정 */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onChangeEnd(Math.max(startTime + 0.2, endTime - 1));
              }}
              type="button"
              className="px-2 py-1.5 text-[10.5px] font-bold bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-xl text-slate-300 font-mono h-9 transition-colors flex items-center justify-center cursor-pointer select-none"
              title="종료 시점 1초 앞으로 당기기"
            >
              -1s
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onChangeEnd(Math.min(duration, endTime + 1));
              }}
              type="button"
              className="px-2 py-1.5 text-[10.5px] font-bold bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-xl text-slate-300 font-mono h-9 transition-colors flex items-center justify-center cursor-pointer select-none"
              title="종료 시점 1초 뒤로 미루기"
            >
              +1s
            </button>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onChangeEnd(Math.max(startTime + 0.2, Math.min(currentTime, duration)));
            }}
            type="button"
            title="현재 재생 위치를 종료지점(B)으로 지정 [단축키: W]"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900/80 hover:bg-rose-500/10 active:scale-95 border border-slate-800 hover:border-rose-500/30 text-slate-300 transition-all cursor-pointer font-sans h-9"
          >
            <span className="text-slate-300 font-semibold text-xs text-[11px]">종료지점 (B):</span>
            <strong className={`font-mono text-xs ${isEndSet ? "text-rose-400" : "text-slate-550"} text-[11px]`}>
              {isEndSet ? formatTime(endTime) : "지정하기"}
            </strong>
            <span className={`w-2 h-2 rounded-full ring-2 ring-rose-950 inline-block ${isEndSet ? "bg-rose-500" : "bg-slate-600 animate-pulse"}`}></span>
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        className="relative h-10 w-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden cursor-pointer"
        id="waveform-area"
      >
        {/* Shaded loop region background */}
        {isStartSet && isEndSet && (
          <div
            className="absolute h-full bg-slate-800/40 border-x border-slate-700/50"
            style={{
              left: `${startPct}%`,
              width: `${endPct - startPct}%`,
            }}
          />
        )}

        {/* Shaded non-loop inactive regions */}
        {isStartSet && (
          <div
            className="absolute h-full left-0 top-0 bg-slate-950/60"
            style={{ width: `${startPct}%` }}
          />
        )}
        {isEndSet && (
          <div
            className="absolute h-full right-0 top-0 bg-slate-950/60"
            style={{ left: `${endPct}%` }}
          />
        )}

        {/* Realistic procedural audio waveform bars */}
        <div className="absolute inset-x-0 inset-y-1.5 flex items-center justify-between px-2 gap-[2px] pointer-events-none">
          {waves.map((height, idx) => {
            const barPct = (idx / waves.length) * 100;
            const effectiveStartPct = isStartSet ? startPct : 0;
            const effectiveEndPct = isEndSet ? endPct : 100;
            const isInsideSelection = barPct >= effectiveStartPct && barPct <= effectiveEndPct;
            const isPassedPlayhead = barPct <= currentPct;

            let barColor = "bg-slate-700 opacity-40";
            if (isInsideSelection) {
              barColor = isPassedPlayhead ? "bg-amber-400 opacity-90" : "bg-teal-500 opacity-60";
            } else if (isPassedPlayhead) {
              barColor = "bg-slate-500 opacity-50";
            }

            return (
              <div
                key={idx}
                className={`flex-1 rounded-sm transition-all duration-150 ${barColor}`}
                style={{
                  height: `${height * 100}%`,
                  minHeight: "4px",
                }}
              />
            );
          })}
        </div>

        {/* Live playhead pointer vertical line */}
        <div
          className="absolute top-0 bottom-0 w-[2px] bg-sky-400 shadow-[0_0_8px_#38bdf8] pointer-events-none transition-all duration-75"
          style={{ left: `${currentPct}%` }}
        >
          <div className="absolute top-0 -left-1 w-2.5 h-2.5 rounded-full bg-sky-400 border border-slate-900" />
        </div>

        {/* Draggable Handle A Line & Ribbon */}
        {isStartSet && (
          <div
            className="absolute top-0 bottom-0 w-[2px] bg-emerald-500 cursor-ew-resize group"
            style={{ left: `${startPct}%` }}
          >
            <div className="absolute -top-1 -left-2.5 w-6 h-6 flex items-center justify-center bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-[10px] rounded-full shadow-[0_2px_5px_rgba(0,0,0,0.5)] border-2 border-slate-900 leading-none">
              A
            </div>
            <div className="absolute bottom-1 -left-1.5 w-3 h-3 bg-emerald-500 border border-slate-900 transform rotate-45" />
          </div>
        )}

        {/* Draggable Handle B Line & Ribbon */}
        {isEndSet && (
          <div
            className="absolute top-0 bottom-0 w-[2px] bg-rose-500 cursor-ew-resize group"
            style={{ left: `${endPct}%` }}
          >
            <div className="absolute -top-1 -left-2.5 w-6 h-6 flex items-center justify-center bg-rose-500 hover:bg-rose-400 text-slate-950 font-extrabold text-[10px] rounded-full shadow-[0_2px_5px_rgba(0,0,0,0.5)] border-2 border-slate-900 leading-none">
              B
            </div>
            <div className="absolute bottom-1 -left-1.5 w-3 h-3 bg-rose-500 border border-slate-900 transform rotate-45" />
          </div>
        )}
      </div>

      {/* Helpful duration coordinates helper footer */}
      <div className="flex justify-between text-[11px] text-slate-500 font-mono mt-1 px-1">
        <span>00:00.0</span>
        <span className="text-amber-500 font-medium">
          선택 구간 간격: {isStartSet && isEndSet ? formatTime(endTime - startTime) : "미지정"}
        </span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}
