import React, { useState } from "react";
import { Bookmark, Folder, PRESET_COLORS } from "../types";
import { 
  FolderPlus, Plus, Trash2, Folder as FolderIcon, Play, 
  Download, Upload, Tag, FileText, ChevronRight, Hash, Edit3 
} from "lucide-react";

interface BookmarkManagerProps {
  bookmarks: Bookmark[];
  folders: Folder[];
  currentVideoId: string;
  currentA: number;
  currentB: number;
  currentSpeed: number;
  onAddBookmark: (bookmark: Omit<Bookmark, "id" | "createdAt">) => void;
  onDeleteBookmark: (id: string) => void;
  onAddFolder: (name: string, color: string) => void;
  onDeleteFolder: (id: string) => void;
  onSelectBookmark: (bookmark: Bookmark) => void;
  onImportData: (bookmarks: Bookmark[], folders: Folder[]) => void;
}

export function BookmarkManager({
  bookmarks,
  folders,
  currentVideoId,
  currentA,
  currentB,
  currentSpeed,
  onAddBookmark,
  onDeleteBookmark,
  onAddFolder,
  onDeleteFolder,
  onSelectBookmark,
  onImportData,
}: BookmarkManagerProps) {
  // Folder UI States
  const [selectedFolderId, setSelectedFolderId] = useState<string>("all");
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState(PRESET_COLORS[0].name);
  const [showAddFolder, setShowAddFolder] = useState(false);

  // Bookmark creation Form States
  const [bmTitle, setBmTitle] = useState("");
  const [bmNotes, setBmNotes] = useState("");
  const [bmTags, setBmTags] = useState("");
  const [bmFolderId, setBmFolderId] = useState("all");
  const [bmSpeed, setBmSpeed] = useState(currentSpeed);
  const [showAddBookmark, setShowAddBookmark] = useState(false);

  // Drag and Drop files import state
  const [isDragOver, setIsDragOver] = useState(false);

  // Helper formats
  const formatTime = (sec: number) => {
    const s = Math.max(0, sec);
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 10);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms}`;
  };

  // Folder creation
  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    onAddFolder(newFolderName.trim(), newFolderColor);
    setNewFolderName("");
    setShowAddFolder(false);
  };

  // Bookmark creation handler
  const handleCreateBookmark = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bmTitle.trim()) return;

    // Split tags by comma
    const tagList = bmTags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    onAddBookmark({
      title: bmTitle.trim(),
      videoId: currentVideoId,
      startTime: currentA,
      endTime: currentB,
      speed: bmSpeed,
      notes: bmNotes.trim(),
      tags: tagList,
      folderId: bmFolderId === "all" ? "" : bmFolderId,
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
        if (Array.isArray(json.bookmarks) && Array.isArray(json.folders)) {
          onImportData(json.bookmarks, json.folders);
          alert(`성공적으로 불러왔습니다! (폴더: ${json.folders.length}개, 구간: ${json.bookmarks.length}개)`);
        } else if (Array.isArray(json)) {
          // Fallback if raw bookmarks list was direct export
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

  // Filters bookmarks by active folders selection
  const filteredBookmarks = bookmarks.filter((bm) => {
    if (selectedFolderId === "all") return true;
    if (selectedFolderId === "unassigned") return !bm.folderId;
    return bm.folderId === selectedFolderId;
  });

  const getFolderDetails = (folderId: string) => {
    return folders.find((f) => f.id === folderId);
  };

  const selectedCol = PRESET_COLORS.find((c) => c.name === newFolderColor) || PRESET_COLORS[0];

  return (
    <div className="space-y-5" id="bookmark-playlist-module">
      
      {/* 1. Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80">
        <div>
          <h3 className="font-sans font-bold text-base text-slate-100 flex items-center gap-2">
            구간 리스트 & 플레이리스트
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">자주 학습하는 핵심 반복 구간을 생성하고 분류하세요.</p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Add Bookmark Trigger */}
          <button
            onClick={() => {
              setBmSpeed(currentSpeed);
              setBmFolderId(selectedFolderId === "unassigned" ? "all" : selectedFolderId);
              setShowAddBookmark(!showAddBookmark);
              setShowAddFolder(false);
            }}
            type="button"
            className="flex items-center gap-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 px-3 py-1.5 rounded-xl font-semibold text-xs transition-all shadow-md active:scale-95"
          >
            <Plus className="w-4 h-4 text-slate-950 font-bold" />
            현구간 추가 (A↔B)
          </button>

          {/* Import/Export buttons */}
          <button
            onClick={handleExport}
            type="button"
            title="구간 리스트 내보내기 (JSON)"
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors"
          >
            <Download className="w-4 h-4" />
          </button>

          <label
            title="구간 리스트 불러오기 (JSON)"
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <input
              type="file"
              accept=".json"
              onChange={handleFileImport}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* 2. Drag and Drop Import Dropzone area (hidden unless dragging) */}
      {isDragOver && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="p-6 bg-indigo-950/40 border-2 border-dashed border-indigo-400 rounded-xl text-center flex flex-col items-center justify-center text-slate-200 animate-pulse duration-1000"
        >
          <Upload className="w-8 h-8 text-indigo-400 mb-2" />
          <p className="text-sm font-semibold">이곳에 JSON 백업 파일을 드롭하여 즉시 북마크와 분류 폴더를 불러오세요.</p>
        </div>
      )}

      {/* 3. Add Bookmark Form Popup/Drawer */}
      {showAddBookmark && (
        <form
          onSubmit={handleCreateBookmark}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 animate-in slide-in-from-top-4 duration-200"
        >
          <div className="flex justify-between items-center pb-2 border-b border-slate-800">
            <h4 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-emerald-400" />
              새로운 반복 학습 구간 추가
            </h4>
            <span className="text-[10.5px] text-indigo-300 bg-slate-950 font-mono py-0.5 px-2 rounded-full border border-slate-800">
              구간 범위: {formatTime(currentA)} ~ {formatTime(currentB)} ({formatTime(currentB - currentA)}초)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">구간 이름 *</label>
              <input
                type="text"
                placeholder="예: 1절 하이라이트 후렴구, 어려운 영어 발음"
                value={bmTitle}
                onChange={(e) => setBmTitle(e.target.value)}
                required
                className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">태그 (쉼표로 구분)</label>
              <input
                type="text"
                placeholder="예: 발음연습, 영어, 구간후렴"
                value={bmTags}
                onChange={(e) => setBmTags(e.target.value)}
                className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">선택 폴더</label>
              <select
                value={bmFolderId}
                onChange={(e) => setBmFolderId(e.target.value)}
                className="w-full bg-slate-950 text-slate-200 border border-slate-800 rounded-xl px-2.5 py-2 text-xs focus:outline-none"
              >
                <option value="all">기본 저장위치 (미분류)</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    📁 {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">구간별 권장 배속</label>
              <select
                value={bmSpeed}
                onChange={(e) => setBmSpeed(parseFloat(e.target.value))}
                className="w-full bg-slate-950 text-slate-200 border border-slate-800 rounded-xl px-2.5 py-2 text-xs focus:outline-none"
              >
                {[0.25, 0.5, 0.75, 0.8, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0].map((s) => (
                  <option key={s} value={s}>
                    {s === 1.0 ? "기본 배속 (1.0x)" : `${s.toFixed(2)}x`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">메모 및 메모리</label>
              <input
                type="text"
                placeholder="해당 반복 구간의 키포인트 기록"
                value={bmNotes}
                onChange={(e) => setBmNotes(e.target.value)}
                className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowAddBookmark(false)}
              type="button"
              className="px-3.5 py-1.5 rounded-xl hover:bg-slate-800 text-slate-300 text-xs transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              className="bg-indigo-500 hover:bg-indigo-400 text-slate-100 font-bold px-4 py-1.5 rounded-xl text-xs transition-colors shadow-md"
            >
              추가 완료
            </button>
          </div>
        </form>
      )}

      {/* 4. Folder Manager Drawer */}
      {showAddFolder && (
        <form
          onSubmit={handleCreateFolder}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3.5 animate-in slide-in-from-top-4 duration-200"
        >
          <div className="flex justify-between items-center pb-1">
            <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1">
              <FolderPlus className="w-4 h-4 text-sky-400" />
              새로운 구간 분류 폴더 만들기
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">폴더 이름</label>
              <input
                type="text"
                placeholder="예: 영어 발음 체크, 댄스 카피, 기타 코드"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                required
                className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">테마 컬러</label>
              <div className="flex items-center gap-2">
                <select
                  value={newFolderColor}
                  onChange={(e) => setNewFolderColor(e.target.value)}
                  className="bg-slate-950 text-slate-200 border border-slate-800 rounded-xl px-2 py-1.5 text-xs focus:outline-none flex-1"
                >
                  {PRESET_COLORS.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <div className={`w-6 h-6 rounded-full border border-slate-800 ${selectedCol.class}`} />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowAddFolder(false)}
              type="button"
              className="px-3 py-1 rounded hover:bg-slate-800 text-slate-300 text-xs transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold px-3 py-1 rounded text-xs transition-colors shadow-md"
            >
              폴더 생성
            </button>
          </div>
        </form>
      )}

      {/* 5. Folder Filter Badges & Folders List Area */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400">카테고리 폴더 필터:</span>
          <button
            onClick={() => {
              setShowAddFolder(!showAddFolder);
              setShowAddBookmark(false);
            }}
            type="button"
            className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-0.5"
          >
            <Plus className="w-3.5 h-3.5" /> 폴더 생성
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setSelectedFolderId("all")}
            type="button"
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              selectedFolderId === "all"
                ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/15"
                : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850"
            }`}
          >
            📋 전체 보기 ({bookmarks.length})
          </button>

          <button
            onClick={() => setSelectedFolderId("unassigned")}
            type="button"
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              selectedFolderId === "unassigned"
                ? "bg-slate-700 border-slate-600 text-white shadow-md"
                : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850"
            }`}
          >
            🏷️ 미분류 ({bookmarks.filter((b) => !b.folderId).length})
          </button>

          {folders.map((f) => {
            const count = bookmarks.filter((b) => b.folderId === f.id).length;
            const isSelected = selectedFolderId === f.id;
            const colorMeta = PRESET_COLORS.find((pc) => pc.name === f.color) || PRESET_COLORS[0];

            return (
              <div key={f.id} className="flex items-center gap-0.5">
                <button
                  onClick={() => setSelectedFolderId(f.id)}
                  type="button"
                  className={`px-3 py-1.5 rounded-l-full text-xs font-semibold border-y border-l transition-all flex items-center gap-1 ${
                    isSelected
                      ? `bg-slate-800 border-slate-700 text-white ${colorMeta.text}`
                      : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${colorMeta.class}`} />
                  {f.name} ({count})
                </button>
                <button
                  onClick={() => {
                    if (confirm(`'${f.name}' 폴더를 정말 삭제하시겠습니까? 안의 북마크들은 미분류로 전환됩니다.`)) {
                      onDeleteFolder(f.id);
                      if (selectedFolderId === f.id) setSelectedFolderId("all");
                    }
                  }}
                  type="button"
                  title="폴더 삭제"
                  className="px-2 py-1.5 rounded-r-full bg-slate-900 border-y border-r border-slate-800 hover:bg-slate-850 text-slate-500 hover:text-rose-400 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. Bookmark Results List */}
      <div className="space-y-2">
        {filteredBookmarks.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-8 text-center text-slate-400 text-xs">
            ✨ 이 카테고리에 저장된 반복 구간이 없습니다. 
            <br />
            영상을 시청하다 위 버튼을 클릭해 현재 마킹된 {formatTime(currentA)} ~ {formatTime(currentB)} 사이의 구간을 바로 북마크 목록에 간직해보세요.
          </div>
        ) : (
          filteredBookmarks.map((bm) => {
            const fDetails = bm.folderId ? getFolderDetails(bm.folderId) : undefined;
            const col = fDetails ? PRESET_COLORS.find((pc) => pc.name === fDetails.color) || PRESET_COLORS[0] : null;

            return (
              <div
                key={bm.id}
                className="group relative bg-slate-900 border border-slate-800 rounded-2xl hover:border-slate-700/80 p-4 transition-all hover:shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                {/* Information segment */}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* Folder label badge */}
                    {fDetails && col && (
                      <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-full ${col.class} text-slate-950 inline-flex items-center gap-0.5`}>
                        <FolderIcon className="w-2.5 h-2.5" />
                        {fDetails.name}
                      </span>
                    )}
                    {/* Duration badge */}
                    <span className="bg-indigo-950/80 text-indigo-300 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-lg border border-indigo-900/30">
                      ⏱️ {formatTime(bm.startTime)} ~ {formatTime(bm.endTime)}
                    </span>
                    <span className="bg-slate-950 text-slate-350 text-[10px] font-mono px-2 py-0.5 rounded-lg border border-slate-800">
                      ⚡ {bm.speed.toFixed(2)}x 배속 권장
                    </span>
                  </div>

                  <h5 className="font-sans font-bold text-sm text-slate-200 mt-1 truncate">
                    {bm.title}
                  </h5>

                  {/* Notes / Subtitle annotation memo */}
                  {bm.notes && (
                    <p className="text-[11.5px] text-slate-405 italic flex items-center gap-1 text-slate-400">
                      <FileText className="w-3.5 h-3.5 text-slate-500" />
                      {bm.notes}
                    </p>
                  )}

                  {/* Tags list */}
                  {bm.tags && bm.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {bm.tags.map((tag, idx) => (
                        <span key={idx} className="text-[9.5px] text-teal-300 bg-teal-950/40 border border-teal-900/30 rounded px-1.5 py-0.5 flex items-center gap-0.5">
                          <Tag className="w-2.5 h-2.5 opacity-60" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* If bookmarks is from a different Youtube Video */}
                  {bm.videoId !== currentVideoId && (
                    <div className="text-[10.5px] text-amber-400 bg-amber-950/20 border border-amber-900/10 rounded px-2 py-0.5 inline-block">
                      ⚠️ 주의: 다른 동영상 소스입니다. 클릭 시 해당 비디오로 변환 및 탐색합니다.
                    </div>
                  )}
                </div>

                {/* Actions buttons segment */}
                <div className="flex items-center gap-2 self-stretch md:self-auto justify-end border-t border-slate-800/45 pt-2.5 md:pt-0 md:border-0">
                  <button
                    onClick={() => onSelectBookmark(bm)}
                    type="button"
                    className="flex-1 md:flex-initial flex items-center justify-center gap-1 bg-indigo-500/20 hover:bg-indigo-500 text-indigo-300 hover:text-white border border-indigo-500/30 px-3.5 py-2 md:py-1.5 rounded-xl text-xs font-semibold transition-all group-hover:scale-102"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    구간 즉시 로드
                  </button>

                  <button
                    onClick={() => {
                      if (confirm(`'${bm.title}' 구간을 즐겨찾기 목록에서 삭제하시겠습니까?`)) {
                        onDeleteBookmark(bm.id);
                      }
                    }}
                    type="button"
                    title="북마크 삭제"
                    className="p-2 rounded-xl bg-slate-950 border border-slate-800/80 hover:bg-rose-950/60 text-slate-500 hover:text-rose-400 hover:border-rose-900/30 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
