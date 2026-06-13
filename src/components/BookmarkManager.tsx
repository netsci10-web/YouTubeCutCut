import React, { useState } from "react";
import { Bookmark, Folder } from "../types";
import { 
  Plus, Trash2, Play, Pause,
  Download, Upload, Tag, FileText, ChevronRight, ChevronLeft, Edit3,
  ChevronUp, ChevronDown, Loader
} from "lucide-react";

interface BookmarkManagerProps {
  bookmarks: Bookmark[];
  folders?: Folder[];
  currentVideoId: string;
  currentVideoTitle?: string;
  currentChannelName?: string;
  currentA: number;
  currentB: number;
  currentSpeed: number;
  currentVolume?: number;
  activeBookmarkId?: string | null;
  isSequentialPlayActive?: boolean;
  onToggleSequentialPlay?: () => void;
  onToggleBookmarkChecked?: (id: string) => void;
  onMoveBookmarkUp?: (id: string) => void;
  onMoveBookmarkDown?: (id: string) => void;
  onPlayNext?: () => void;
  onPlayPrev?: () => void;
  onAddBookmark: (bookmark: Omit<Bookmark, "id" | "createdAt">) => void;
  onDeleteBookmark: (id: string) => void;
  onAddFolder?: (name: string, color: string) => void;
  onDeleteFolder?: (id: string) => void;
  onSelectBookmark: (bookmark: Bookmark, autoPlay?: boolean) => void;
  onUpdateBookmark?: (id: string, updatedFields: Partial<Bookmark>) => void;
  onImportData: (bookmarks: Bookmark[], folders: Folder[]) => void;
}

export function BookmarkManager({
  bookmarks,
  folders = [],
  currentVideoId,
  currentVideoTitle,
  currentChannelName,
  currentA,
  currentB,
  currentSpeed,
  currentVolume = 100,
  activeBookmarkId,
  isSequentialPlayActive = false,
  onToggleSequentialPlay,
  onToggleBookmarkChecked,
  onMoveBookmarkUp,
  onMoveBookmarkDown,
  onPlayNext,
  onPlayPrev,
  onAddBookmark,
  onDeleteBookmark,
  onSelectBookmark,
  onUpdateBookmark,
  onImportData,
}: BookmarkManagerProps) {
  // Collapsible Card State
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Safe delete state configurations
  const [deletingBookmarkId, setDeletingBookmarkId] = useState<string | null>(null);

  // Bookmark creation Form States
  const [bmTitle, setBmTitle] = useState("");
  const [bmNotes, setBmNotes] = useState("");
  const [bmTags, setBmTags] = useState("");
  const [bmSpeed, setBmSpeed] = useState(currentSpeed);
  const [showAddBookmark, setShowAddBookmark] = useState(false);

  // Drag and Drop files import state
  const [isDragOver, setIsDragOver] = useState(false);

  // Inline edit state
  const [editingBmId, setEditingBmId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editStartTime, setEditStartTime] = useState<number>(0);
  const [editEndTime, setEditEndTime] = useState<number>(0);
  const [editSpeed, setEditSpeed] = useState<number>(1.0);
  const [editVolume, setEditVolume] = useState<number>(100);

  // Helper formats
  const formatTime = (sec: number) => {
    const s = Math.max(0, sec);
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 10);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms}`;
  };

  // Bookmark creation handler
  const handleCreateBookmark = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bmTitle.trim()) return;

    const tagList = bmTags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    onAddBookmark({
      title: bmTitle.trim(),
      videoId: currentVideoId,
      videoTitle: currentVideoTitle,
      channelName: currentChannelName,
      startTime: currentA,
      endTime: currentB,
      speed: bmSpeed,
      notes: "",
      tags: tagList,
      folderId: "",
      volume: currentVolume,
    });

    // Reset forms
    setBmTitle("");
    setBmNotes("");
    setBmTags("");
    setShowAddBookmark(false);
  };

  // Export JSON functionality
  const handleExport = () => {
    const dataToExport = {
      bookmarks,
      folders: [],
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
  };

  // Import JSON functionality
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readAndImportJson(file);
  };

  const readAndImportJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (Array.isArray(json.bookmarks)) {
          onImportData(json.bookmarks, json.folders || []);
          alert(`성공적으로 불러왔습니다! (구간: ${json.bookmarks.length}개)`);
        } else if (Array.isArray(json)) {
          onImportData(json, []);
          alert(`성공적으로 ${json.length}개의 반복 구간을 불러왔습니다!`);
        } else {
          alert("올바르지 않은 백업 파일 포맷입니다.");
        }
      } catch (err) {
        alert("JSON 파일 파싱 중 오류가 발생했습니다.");
      }
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === "application/json") {
      readAndImportJson(file);
    } else {
      alert("JSON 구성 파일을 제공해 주세요.");
    }
  };

  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4.5 space-y-4 shadow-xl" id="bookmark-playlist-module">
      
      {/* 1. Collapsible Header Card */}
      <div 
        onClick={() => setIsCollapsed(!isCollapsed)} 
        className="flex items-center justify-between gap-3 cursor-pointer p-1 -m-1 rounded-xl hover:bg-slate-900/45 transition-colors select-none"
      >
        <div className="flex items-center gap-2">
          <h3 className="font-sans font-bold text-sm text-slate-100 flex items-center gap-2">
            📋 구간 플레이리스트
          </h3>
          <span className="bg-indigo-550/15 text-indigo-400 font-bold font-mono text-[10.5px] px-2 py-0.5 rounded-full border border-indigo-500/15">
            {bookmarks.length}
          </span>
        </div>
        <div className="text-slate-400 hover:text-slate-200 p-1">
          <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${isCollapsed ? "" : "rotate-90"}`} />
        </div>
      </div>

      {/* Collapsible Content */}
      {!isCollapsed && (
        <div className="space-y-4 pt-1 border-t border-slate-900/50">
          
          {/* 2. Drag and Drop Import Dropzone area (hidden unless dragging) */}
          {isDragOver && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className="p-6 bg-indigo-950/40 border-2 border-dashed border-indigo-400 rounded-xl text-center flex flex-col items-center justify-center text-slate-200 animate-pulse duration-1000"
            >
              <Upload className="w-8 h-8 text-indigo-400 mb-2" />
              <p className="text-sm font-semibold">이곳에 JSON 백업 파일을 드롭하여 즉시 북마크 구간을 불러오세요.</p>
            </div>
          )}

          {/* 3. Add Bookmark Form Popup/Drawer */}
          {showAddBookmark && (
            <form
              onSubmit={handleCreateBookmark}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-4.5 space-y-4 animate-in slide-in-from-top-4 duration-200"
            >
              <div className="pb-2.5 border-b border-slate-800/80 space-y-2">
                <h4 className="text-sm font-bold text-slate-200 flex items-center gap-1.5 font-display">
                  <Plus className="w-4 h-4 text-emerald-400" />
                  현재 구간을 플레이리스트에 추가
                </h4>
                <div className="text-[11px] text-indigo-300 font-mono inline-block bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-850 font-medium">
                  구간 범위: <span className="font-bold text-emerald-400">{formatTime(currentA)} ~ {formatTime(currentB)}</span>
                </div>
              </div>

              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-450 mb-1">구간 설명 및 메모 *</label>
                  <input
                    type="text"
                    placeholder="예: 후렴구 하이라이트 구간 또는 3초 f 발음 따라 하기"
                    value={bmTitle}
                    onChange={(e) => setBmTitle(e.target.value)}
                    required
                    className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-550"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-455 mb-1">구간별 권장 배속 설정</label>
                  <select
                    value={bmSpeed}
                    onChange={(e) => setBmSpeed(parseFloat(e.target.value))}
                    className="w-full bg-slate-950 text-slate-200 border border-slate-800 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:border-indigo-550"
                  >
                    {[0.25, 0.5, 0.75, 0.8, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0].map((s) => (
                      <option key={s} value={s}>
                        {s === 1.0 ? "기본 배속 (1.0x)" : `${s.toFixed(2)}x`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setShowAddBookmark(false)}
                  type="button"
                  className="px-3.5 py-1.5 rounded-xl hover:bg-slate-800 text-slate-300 text-xs transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="bg-indigo-505 hover:bg-indigo-405 text-white font-bold px-4 py-1.5 rounded-xl text-xs transition-colors shadow-md cursor-pointer"
                >
                  추가 완료
                </button>
              </div>
            </form>
          )}

          {/* 4. Menu & Backups controls */}
          <div className="flex items-center justify-between border-b border-slate-900 pb-3 gap-2 flex-wrap">
            <button
              onClick={() => {
                const nextVal = !showAddBookmark;
                setShowAddBookmark(nextVal);
                if (nextVal) {
                  setBmTitle(currentVideoTitle || "새로운 학습 구간");
                  setBmNotes("");
                  setBmTags("");
                  setBmSpeed(currentSpeed);
                }
              }}
              type="button"
              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-md shadow-emerald-950/40 cursor-pointer border border-emerald-500/35"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>구간추가</span>
            </button>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleExport}
                type="button"
                className="p-1.8 text-slate-300 hover:text-indigo-400 bg-slate-900 hover:bg-slate-850 rounded-xl border border-slate-800 cursor-pointer transition-colors"
                title="북마크 JSON 데이터 백업 파일로 저장하기"
              >
                <Download className="w-3.5 h-3.5" />
              </button>

              <label 
                className="p-1.8 text-slate-300 hover:text-indigo-400 bg-slate-900 hover:bg-slate-850 rounded-xl border border-slate-800 cursor-pointer transition-colors inline-block"
                title="북마크 JSON 데이터 복원 및 불러오기"
              >
                <Upload className="w-3.5 h-3.5" />
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileImport}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Sequential Playback Media Control Bar */}
          {(() => {
            const checkedBMs = bookmarks.filter((bm) => bm.checked !== false);
            const currentIndex = checkedBMs.findIndex((bm) => bm.id === activeBookmarkId);
            const prevDisabled = checkedBMs.length === 0 || currentIndex === 0;
            const nextDisabled = checkedBMs.length === 0 || (currentIndex !== -1 && currentIndex === checkedBMs.length - 1);

            return (
              <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-3 mb-3 space-y-3 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full inline-block ${isSequentialPlayActive ? "bg-indigo-400 animate-pulse" : "bg-slate-600"}`} />
                    <span>체크된 구간 순차 자동 재생 제어</span>
                  </span>
                  <span className="text-[9.5px] text-slate-500 font-mono">
                    {checkedBMs.length}개 구간 선택됨
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Prev Button */}
                  <button
                    onClick={onPlayPrev}
                    disabled={prevDisabled}
                    type="button"
                    className={`flex-1 h-9 rounded-xl border text-slate-300 hover:text-white transition-all text-xs font-bold flex items-center justify-center cursor-pointer ${
                      prevDisabled
                        ? "opacity-30 bg-slate-900 border-slate-850 text-slate-600 cursor-not-allowed"
                        : "bg-slate-950 hover:bg-slate-850 border-slate-800 active:scale-95"
                    }`}
                    title={prevDisabled ? "첫 번째 구간입니다" : "이전 체크 구간으로 이동"}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {/* Play/Stop Sequential Sequence Button */}
                  <button
                    onClick={onToggleSequentialPlay}
                    type="button"
                    className={`flex-[1.5] h-9 rounded-xl border font-bold transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                      isSequentialPlayActive
                        ? "bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-455 shadow-md shadow-indigo-900/35"
                        : "bg-slate-950 text-indigo-400 hover:bg-slate-900 border-slate-850"
                    }`}
                    title={isSequentialPlayActive ? "순차 자동 재생 끄기" : "순차 자동 재생 켜기"}
                  >
                    {isSequentialPlayActive ? (
                      <Pause className="w-3.5 h-3.5" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current" />
                    )}
                  </button>

                  {/* Next Button */}
                  <button
                    onClick={onPlayNext}
                    disabled={nextDisabled}
                    type="button"
                    className={`flex-1 h-9 rounded-xl border text-slate-300 hover:text-white transition-all text-xs font-bold flex items-center justify-center cursor-pointer ${
                      nextDisabled
                        ? "opacity-30 bg-slate-900 border-slate-850 text-slate-600 cursor-not-allowed"
                        : "bg-slate-950 hover:bg-slate-850 border-slate-805 active:scale-95"
                    }`}
                    title={nextDisabled ? "마지막 구간입니다" : "다음 체크 구간으로 이동"}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })()}

          {/* 5. Bookmarks flat list with front title and rear 2x2 actions */}
          <div className="space-y-1 max-h-[480px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-850">
            {bookmarks.length === 0 ? (
              <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-6 text-center text-slate-400 text-xs">
                ✨ 플레이리스트에 저장된 구간이 없습니다. 
                <br />
                영상을 재생한 뒤 위 버튼을 눌러 소중한 학습 구간을 기록하세요.
              </div>
            ) : (
              bookmarks.map((bm) => {
                const isEditing = editingBmId === bm.id;
                return (
                  <div
                    key={bm.id}
                    className={`group relative bg-slate-900/95 border hover:border-slate-700/80 rounded-xl py-1 px-2.5 transition-all flex items-center justify-between gap-2.5 ${
                      activeBookmarkId === bm.id
                        ? "border-indigo-500/80 shadow-md shadow-indigo-950/20 bg-indigo-950/15"
                        : "border-slate-800/85"
                    }`}
                  >
                    {isEditing ? (
                      <div className="w-full py-1.5 space-y-2">
                        <div className="space-y-1.5 bg-slate-900 border border-slate-850 p-2.5 rounded-lg">
                          <div>
                            <label className="block text-[10px] text-slate-400 font-bold mb-0.5">구간 설명 및 메모 (제목) *</label>
                            <input
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1 text-xs text-slate-100 focus:outline-none focus:border-indigo-550"
                              placeholder="구간 이름을 입력하세요"
                              autoFocus
                            />
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[9px] text-slate-400 font-bold mb-0.5">시작 지점 (A) - 초단위</label>
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                value={editStartTime}
                                onChange={(e) => setEditStartTime(parseFloat(e.target.value) || 0)}
                                className="w-full bg-slate-950 border border-slate-850 rounded-lg px-2 py-0.5 text-xs text-emerald-400 font-mono text-center"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] text-slate-400 font-bold mb-0.5">종료 지점 (B) - 초단위</label>
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                value={editEndTime}
                                onChange={(e) => setEditEndTime(parseFloat(e.target.value) || 0)}
                                className="w-full bg-slate-950 border border-slate-850 rounded-lg px-2 py-0.5 text-xs text-rose-450 font-mono text-center"
                              />
                            </div>
                          </div>

                          {/* 현재 플레이어의 실시간 조절된 구간 받아오기 버튼 */}
                          <div className="flex flex-col gap-1.5 bg-slate-950/60 border border-slate-850/40 p-2 rounded-lg mt-1">
                            <span className="text-[9.5px] text-slate-400 font-medium">
                              현재 세팅 구간: <strong className="text-emerald-400 font-mono">{formatTime(currentA)} ~ {formatTime(currentB)}</strong>
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditStartTime(Number(currentA.toFixed(2)));
                                setEditEndTime(Number(currentB.toFixed(2)));
                              }}
                              className="w-full py-1.5 bg-slate-900 hover:bg-slate-850 border border-indigo-500/20 hover:border-indigo-500/50 text-indigo-400 hover:text-indigo-300 text-[10px] font-bold rounded-md cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-1"
                              title="현재 유튜브 학습 동영상 플레이어에서 조절한 구간 시간값을 양식에 대입합니다"
                            >
                              🔄 현재 동영상의 구간 적용하기
                            </button>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[9px] text-slate-400 font-bold mb-0.5">권장 재생 속도</label>
                              <select
                                value={editSpeed}
                                onChange={(e) => setEditSpeed(parseFloat(e.target.value))}
                                className="w-full bg-slate-950 border border-slate-850 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-550"
                              >
                                {[0.25, 0.5, 0.75, 0.8, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0].map((s) => (
                                  <option key={s} value={s}>
                                    {s === 1.0 ? "기본 배속 (1.0x)" : `${s.toFixed(2)}x`}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-[9px] text-slate-400 font-bold mb-0.5">권장 소리 크기 (%)</label>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={editVolume}
                                onChange={(e) => setEditVolume(Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)))}
                                className="w-full bg-slate-950 border border-slate-850 rounded-lg px-2 py-1 text-xs text-indigo-400 font-mono text-center focus:outline-none focus:border-indigo-550"
                              />
                            </div>
                          </div>
                          
                          <div className="flex gap-1.5 justify-end">
                            <button
                              onClick={() => setEditingBmId(null)}
                              className="px-2 py-0.5 text-[10px] bg-slate-800 text-slate-350 rounded-md font-bold cursor-pointer"
                              type="button"
                            >
                              취소
                            </button>
                            <button
                              onClick={() => {
                                if (editStartTime > editEndTime) {
                                  alert("시작 지점이 종료 지점보다 뒤에 있을 수 없습니다!");
                                  return;
                                }
                                if (onUpdateBookmark && editTitle.trim()) {
                                  onUpdateBookmark(bm.id, {
                                    title: editTitle.trim(),
                                    notes: "",
                                    startTime: Number(editStartTime.toFixed(2)),
                                    endTime: Number(editEndTime.toFixed(2)),
                                    speed: editSpeed,
                                    volume: editVolume,
                                  });
                                }
                                setEditingBmId(null);
                              }}
                              className="px-2 py-0.5 text-[10px] bg-indigo-650 hover:bg-indigo-550 text-white font-bold rounded-md cursor-pointer"
                              type="button"
                            >
                              저장
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Left Section: Checkbox + Reorder arrows + Title and notes */}
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {/* Checkbox */}
                          <input
                            type="checkbox"
                            checked={bm.checked !== false}
                            onChange={() => onToggleBookmarkChecked?.(bm.id)}
                            className="w-4 h-4 rounded text-indigo-550 accent-indigo-550 border-slate-700 bg-slate-950 focus:ring-indigo-550 shrink-0 cursor-pointer"
                          />

                          {/* Reorder Buttons (Up / Down) */}
                          <div className="flex flex-col gap-0.5 shrink-0">
                            <button
                              onClick={() => onMoveBookmarkUp?.(bm.id)}
                              type="button"
                              className="p-0.5 text-slate-500 hover:text-indigo-400 hover:bg-slate-850 rounded transition-colors"
                              title="위로 이동"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onMoveBookmarkDown?.(bm.id)}
                              type="button"
                              className="p-0.5 text-slate-500 hover:text-indigo-400 hover:bg-slate-850 rounded transition-colors"
                              title="아래로 이동"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Title & metadata info */}
                          <div className="min-w-0 flex-1">
                            <div className="space-y-1">
                              <div className="font-semibold text-slate-100 text-xs truncate leading-normal flex items-center gap-1">
                                {activeBookmarkId === bm.id && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse inline-block" />
                                )}
                                <span title={bm.title} className="text-slate-200 font-bold">{bm.title}</span>
                              </div>
                              
                              {/* Time & Speed metadata indicators */}
                              <div className="flex flex-wrap items-center gap-1 font-mono text-[9px]">
                                <span className="text-emerald-400 font-bold bg-emerald-500/10 px-1 py-0.2 rounded border border-emerald-500/10">
                                  ⏱️ {formatTime(bm.startTime)} ~ {formatTime(bm.endTime)}
                                </span>
                                {bm.speed !== 1 && (
                                  <span className="text-indigo-300 bg-indigo-500/15 px-1 py-0.2 rounded border border-indigo-500/10 font-bold">
                                    {bm.speed.toFixed(2)}x
                                  </span>
                                )}
                                {bm.volume !== undefined && bm.volume !== 100 && (
                                  <span className="text-amber-400 bg-amber-500/10 px-1 py-0.2 rounded border border-amber-500/10 font-bold">
                                    🔊 {bm.volume}%
                                  </span>
                                )}
                              </div>

                              {/* Stored YouTube Title and contents details */}
                              {bm.videoTitle && (
                                <div className="text-[9.5px] text-slate-400 truncate max-w-[170px] sm:max-w-[240px]" title={bm.videoTitle}>
                                  📺 {bm.videoTitle}
                                </div>
                              )}

                              {bm.notes && bm.notes !== "빠른 추가 구간" && (
                                <div className="bg-indigo-950/10 border border-indigo-900/20 rounded-lg p-1 mt-0.5 select-text">
                                  <p className="text-[10px] text-slate-350 leading-relaxed font-sans font-medium break-words whitespace-pre-wrap">
                                    {bm.notes}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right Section: 2x2 control panel matching user specifications */}
                        <div className="grid grid-cols-2 gap-1 shrink-0 w-[60px]">
                          {/* Top-Left: 즉시로드 */}
                          <button
                            onClick={() => onSelectBookmark(bm, false)}
                            type="button"
                            className="w-7 h-7 bg-slate-800 border border-slate-700/80 hover:bg-slate-700 hover:text-slate-100 rounded-lg text-slate-300 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                            title="구간 즉시로드"
                          >
                            <Loader className="w-3.5 h-3.5 text-slate-450 shrink-0" />
                          </button>

                          {/* Top-Right: 자동플레이 */}
                          <button
                            onClick={() => onSelectBookmark(bm, true)}
                            type="button"
                            className="w-7 h-7 bg-indigo-600 border border-indigo-550 hover:bg-indigo-500 hover:border-white rounded-lg text-white flex items-center justify-center transition-all cursor-pointer shadow-md shadow-indigo-950/20"
                            title="자동 플레이"
                          >
                            <Play className="w-3 h-3 fill-current text-white shrink-0" />
                          </button>

                          {/* Bottom-Left: 수정 */}
                          <button
                            onClick={() => {
                              if (editingBmId === bm.id) {
                                setEditingBmId(null);
                              } else {
                                setEditingBmId(bm.id);
                                setEditTitle(bm.title);
                                setEditNotes(bm.notes || "");
                                if (activeBookmarkId === bm.id) {
                                  setEditStartTime(Number(currentA.toFixed(2)));
                                  setEditEndTime(Number(currentB.toFixed(2)));
                                  setEditSpeed(currentSpeed);
                                  setEditVolume(currentVolume !== undefined ? currentVolume : (bm.volume || 100));
                                } else {
                                  setEditStartTime(bm.startTime);
                                  setEditEndTime(bm.endTime);
                                  setEditSpeed(bm.speed || 1.0);
                                  setEditVolume(bm.volume || 100);
                                }
                              }
                            }}
                            type="button"
                            className={`w-7 h-7 border rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                              editingBmId === bm.id
                                ? "bg-amber-500 text-slate-950 border-amber-400"
                                : "bg-slate-950 border-slate-850 hover:bg-slate-900 hover:border-slate-800 text-slate-450 hover:text-slate-200"
                            }`}
                            title="구간 정보 수정"
                          >
                            <Edit3 className="w-3.5 h-3.5 shrink-0" />
                          </button>

                          {/* Bottom-Right: 삭제 */}
                          <button
                            onClick={() => {
                              if (deletingBookmarkId === bm.id) {
                                onDeleteBookmark(bm.id);
                                setDeletingBookmarkId(null);
                              } else {
                                setDeletingBookmarkId(bm.id);
                                setTimeout(() => setDeletingBookmarkId((prev) => (prev === bm.id ? null : prev)), 3000);
                              }
                            }}
                            type="button"
                            className={`w-7 h-7 border rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                              deletingBookmarkId === bm.id
                                ? "bg-rose-500 text-white border-rose-400 animate-pulse animate-bounce"
                                : "bg-slate-950 border-slate-800 hover:bg-slate-900 hover:border-slate-800 text-slate-550 hover:text-rose-400"
                            }`}
                            title={deletingBookmarkId === bm.id ? "클릭 시 즉시 삭제 (확인)" : "구간 삭제"}
                          >
                            {deletingBookmarkId === bm.id ? (
                              <Trash2 className="w-3.5 h-3.5 shrink-0 text-white" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                            )}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>

        </div>
      )}

    </div>
  );
}
