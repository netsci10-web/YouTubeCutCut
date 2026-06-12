export interface Bookmark {
  id: string;
  title: string;
  videoId: string;
  videoTitle?: string;
  channelName?: string;
  startTime: number;
  endTime: number;
  speed: number;
  notes: string;
  tags: string[];
  folderId: string;
  createdAt: number;
  checked?: boolean;
  volume?: number;
}

export interface Folder {
  id: string;
  name: string;
  color: string;
}

export interface HotkeyConfig {
  setStart: string;    // Save/input current A time
  setEnd: string;      // Save/input current B time
  playPause: string;   // Play/pause toggle
  loopToggle: string;  // Loop repetition active toggle
  speedDown: string;   // Adjust playback rate down
  speedUp: string;     // Adjust playback rate up
  rewind10: string;    // Jump back 10s
  forward10: string;   // Jump forward 10s
  frameBack: string;   // Jump back 1 frame
  frameForward: string;// Jump forward 1 frame
  captureStart: string;// "오늘의 핫캡처 A" (여기! A)
  captureEnd: string;  // "오늘의 핫캡처 B" (여기! B)
}

export interface VideoMetadata {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  duration: number;
  loading: boolean;
  error?: string;
}

export const PRESET_COLORS = [
  { name: "Slate", class: "bg-slate-500", text: "text-slate-200", border: "border-slate-500" },
  { name: "Cyan", class: "bg-cyan-500", text: "text-cyan-200", border: "border-cyan-500" },
  { name: "Emerald", class: "bg-emerald-500", text: "text-emerald-200", border: "border-emerald-500" },
  { name: "Amber", class: "bg-amber-500", text: "text-amber-200", border: "border-amber-500" },
  { name: "Rose", class: "bg-rose-500", text: "text-rose-200", border: "border-rose-500" },
  { name: "Purple", class: "bg-purple-500", text: "text-purple-200", border: "border-purple-500" },
];

export const DEFAULT_HOTKEYS: HotkeyConfig = {
  setStart: "[",
  setEnd: "]",
  playPause: " ",
  loopToggle: "l",
  speedDown: "-",
  speedUp: "=",
  rewind10: "ArrowLeft",
  forward10: "ArrowRight",
  frameBack: ",",
  frameForward: ".",
  captureStart: "q",
  captureEnd: "w",
};
