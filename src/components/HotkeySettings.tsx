import React, { useState, useEffect } from "react";
import { HotkeyConfig, DEFAULT_HOTKEYS } from "../types";
import { Keyboard, RotateCcw, X, Check } from "lucide-react";

interface HotkeySettingsProps {
  config: HotkeyConfig;
  onUpdate: (newConfig: HotkeyConfig) => void;
  onClose: () => void;
}

const ACTION_LABELS: Record<keyof HotkeyConfig, string> = {
  setStart: "구간 시작 시간 지정 (A)",
  setEnd: "구간 종료 시간 지정 (B)",
  playPause: "재생 / 일시정지 토글",
  loopToggle: "구간 반복 재생 켜기/끄기",
  speedDown: "재생 속도 낮추기 (0.1x)",
  speedUp: "재생 속도 높이기 (0.1x)",
  rewind10: "정방 타임스탬프 10초 뒤로",
  forward10: "정방 타임스탬프 10초 앞으로",
  frameBack: "미세 탐색 - 1프레임 뒤로",
  frameForward: "미세 탐색 - 1프레임 앞으로",
  captureStart: "원터치 시작캡처 (\"여기!\" A)",
  captureEnd: "원터치 종료캡처 (\"여기!\" B)",
};

export function HotkeySettings({ config, onUpdate, onClose }: HotkeySettingsProps) {
  const [bindingAction, setBindingAction] = useState<keyof HotkeyConfig | null>(null);

  // Bind keydown listener when we are in keybinding mode
  useEffect(() => {
    if (!bindingAction) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const newKey = e.key; // e.g., " ", "a", "ArrowLeft", "[", "]"
      
      // Prevent assigning escape as keybind since it can conflict
      if (newKey === "Escape") {
        setBindingAction(null);
        return;
      }

      onUpdate({
        ...config,
        [bindingAction]: newKey,
      });
      setBindingAction(null);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [bindingAction, config, onUpdate]);

  const handleReset = () => {
    onUpdate(DEFAULT_HOTKEYS);
  };

  const displayKey = (k: string) => {
    if (k === " ") return "Space";
    if (k.startsWith("Arrow")) return k.replace("Arrow", " ");
    return k.toUpperCase();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-indigo-400" />
            <h3 className="font-sans font-semibold text-lg text-slate-100">단축키 커스텀 설정</h3>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="text-slate-400 hover:text-slate-100 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Box */}
        <div className="p-4 bg-slate-950/40 text-[13px] text-slate-300 border-b border-slate-800/80 leading-relaxed px-6">
          ⚙️ <strong className="text-slate-200">사용 방법:</strong> 변경할 동작의 버튼을 누른 다음, 등록을 원하는 키보드 자판을 즉시 누르세요. <code className="bg-slate-800 px-1 py-0.5 rounded text-indigo-300">Space</code>와 방향키 등 특수 자판도 정상 바인딩 및 매핑 가능합니다.
        </div>

        {/* Config List */}
        <div className="max-h-[360px] overflow-y-auto px-6 py-4 space-y-2">
          {(Object.keys(ACTION_LABELS) as Array<keyof HotkeyConfig>).map((key) => {
            const isBindingThis = bindingAction === key;
            return (
              <div key={key} className="flex items-center justify-between py-2 border-b border-slate-800/30">
                <span className="text-sm text-slate-300">{ACTION_LABELS[key]}</span>
                
                <button
                  onClick={() => setBindingAction(key)}
                  type="button"
                  className={`min-w-[120px] font-mono font-medium text-xs py-1.5 px-3 rounded-lg border text-center transition-all ${
                    isBindingThis
                      ? "bg-indigo-600/30 border-indigo-500 text-indigo-300 animate-pulse"
                      : "bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-indigo-200"
                  }`}
                >
                  {isBindingThis ? "키 입력 대기 중..." : displayKey(config[key])}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950/65 border-t border-slate-800">
          <button
            onClick={handleReset}
            type="button"
            className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 font-medium px-3 py-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            초기 기본값 설정
          </button>
          
          <button
            onClick={onClose}
            type="button"
            className="flex items-center gap-1.5 text-sm text-slate-900 bg-emerald-400 hover:bg-emerald-300 font-semibold px-4 py-2 rounded-xl shadow-lg shadow-emerald-500/10 transition-all"
          >
            <Check className="w-4 h-4" />
            설정 저장 완료
          </button>
        </div>
      </div>
    </div>
  );
}
