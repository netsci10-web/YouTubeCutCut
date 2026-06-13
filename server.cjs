var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_dotenv = __toESM(require("dotenv"), 1);
var import_genai = require("@google/genai");
var import_youtube_captions_scraper = require("youtube-captions-scraper");
import_dotenv.default.config();
function generateFallbackAnalysis(title, duration) {
  const titleLower = title.toLowerCase();
  let topic = "\uB3D9\uC601\uC0C1 \uD559\uC2B5";
  let sentences = [];
  let scenes = [];
  if (titleLower.includes("english") || titleLower.includes(" \uC601\uC5B4") || titleLower.includes("\uD68C\uD654") || titleLower.includes("speaking")) {
    topic = "\uC601\uC5B4 \uD68C\uD654 \uD559\uC2B5";
    sentences = [
      { text: "Hello! Welcome back to our channel.", startTime: 2.5, endTime: 6.2 },
      { text: "Today, we are going to learn essential everyday expressions.", startTime: 7, endTime: 12.5 },
      { text: "Could you please repeat that after me?", startTime: 15.3, endTime: 19.8 },
      { text: "That sounds like a great idea, actually.", startTime: 25.1, endTime: 29.5 },
      { text: "I'd love to help you with that project.", startTime: 38, endTime: 42.4 },
      { text: "Don't worry too much about making mistakes.", startTime: 55.2, endTime: 60.1 },
      { text: "Practice makes perfect, so keep going!", startTime: 72.8, endTime: 77.5 },
      { text: "Let's move on to the next conversation pattern.", startTime: 90.1, endTime: 95.8 },
      { text: "Can you summarize what we discussed today?", startTime: 120.5, endTime: 125.9 },
      { text: "Thank you for watching and see you next time!", startTime: 150.2, endTime: 156 }
    ];
    scenes = [
      { chapterName: "Intro & Greeting", time: 0, description: "\uC624\uD504\uB2DD \uC778\uC0AC \uBC0F \uC624\uB298 \uBC30\uC6B8 \uB0B4\uC6A9 \uC18C\uAC1C \uD654\uBA74" },
      { chapterName: "Pattern 1: Requesting Help", time: 14.5, description: "\uB3C4\uC6C0 \uC694\uCCAD\uD558\uAE30 \uC608\uBB38 \uC2AC\uB77C\uC774\uB4DC \uBC0F \uB9AC\uD3EC\uD305 \uD328\uD134" },
      { chapterName: "Pattern 2: Expressing Opinions", time: 35.2, description: "\uC790\uAE30 \uC758\uACAC\uC744 \uBA85\uD655\uD788 \uC804\uB2EC\uD558\uACE0 \uB9DE\uC7A5\uAD6C\uCE58\uB294 \uBC95 \uD53C\uB4DC\uBC31" },
      { chapterName: "Roleplay Exercise", time: 65, description: "\uC6D0\uC5B4\uBBFC \uB300\uD654 \uC7A5\uBA74 \uC7AC\uC0DD \uBC0F \uC5ED\uD560 \uBD84\uB2F4 \uB9D0\uD558\uAE30 \uC5F0\uC2B5" },
      { chapterName: "Review & Outro", time: 115.8, description: "\uC8FC\uC694 \uC5B4\uD718 \uD034\uC988\uC640 \uD568\uAED8 \uD559\uC2B5 \uB0B4\uC6A9 \uB9C8\uBB34\uB9AC \uC778\uC0AC" }
    ];
  } else if (titleLower.includes("\uCF54\uB529") || titleLower.includes("coding") || titleLower.includes("\uAC1C\uBC1C") || titleLower.includes("python") || titleLower.includes("javascript") || titleLower.includes("react") || titleLower.includes("programming")) {
    topic = "\uD504\uB85C\uADF8\uB798\uBC0D \uAC15\uC88C";
    sentences = [
      { text: "\uC548\uB155\uD558\uC138\uC694! \uC624\uB298\uC740 \uAC1C\uBC1C \uD658\uACBD \uC124\uC815\uBD80\uD130 \uC2DC\uC791\uD574 \uBCF4\uACA0\uC2B5\uB2C8\uB2E4.", startTime: 1.5, endTime: 5.8 },
      { text: "\uBA3C\uC800 \uD130\uBBF8\uB110\uC744 \uC5F4\uACE0 \uD544\uC694\uD55C \uD328\uD0A4\uC9C0\uB97C \uC124\uCE58\uD558\uACA0\uC2B5\uB2C8\uB2E4.", startTime: 7.2, endTime: 11.5 },
      { text: "\uC5EC\uAE30\uC11C \uC911\uC694\uD55C \uC810\uC740 \uBE44\uB3D9\uAE30 \uCC98\uB9AC\uB97C \uC704\uD574 await \uD0A4\uC6CC\uB4DC\uB97C \uC4F0\uB294 \uAC83\uC785\uB2C8\uB2E4.", startTime: 19.4, endTime: 24.8 },
      { text: "\uD568\uC218\uC758 \uC778\uC790\uAC12\uC73C\uB85C \uCF5C\uBC31 \uD568\uC218\uB97C \uB118\uACA8\uC8FC\uB3C4\uB85D \uCF54\uB4DC\uB97C \uC218\uC815\uD574 \uBCF4\uC8E0.", startTime: 32.1, endTime: 37.5 },
      { text: "\uBE0C\uB77C\uC6B0\uC800 \uCF58\uC194 \uCC3D\uC744 \uC5F4\uC5B4\uC11C \uC5D0\uB7EC \uB85C\uADF8\uB97C \uC9C1\uC811 \uBD84\uC11D\uD574 \uBD05\uC2DC\uB2E4.", startTime: 45, endTime: 50.3 },
      { text: "\uCEF4\uD3EC\uB10C\uD2B8\uC758 \uB9AC\uB80C\uB354\uB9C1 \uC870\uAC74\uACFC \uC0DD\uBA85\uC8FC\uAE30\uB97C \uC774\uD574\uD558\uB294 \uAC83\uC774 \uD575\uC2EC\uC785\uB2C8\uB2E4.", startTime: 61.2, endTime: 67.4 },
      { text: "\uC774\uC81C \uB370\uC774\uD130\uBCA0\uC774\uC2A4 \uC11C\uBC84\uC640 API \uC694\uCCAD\uC744 \uC5F0\uACB0\uD574 \uBCF4\uACA0\uC2B5\uB2C8\uB2E4.", startTime: 82.5, endTime: 88 },
      { text: "\uACB0\uACFC\uAC00 \uC131\uACF5\uC801\uC73C\uB85C \uD654\uBA74\uC5D0 \uBC14\uC778\uB529\uB418\uB294\uC9C0 \uAC80\uC99D\uD574 \uBCFC\uAE4C\uC694?", startTime: 104.1, endTime: 109.5 },
      { text: "\uC218\uACE0\uD558\uC168\uC2B5\uB2C8\uB2E4. \uB2E4\uC74C \uC2DC\uAC04\uC5D0\uB294 \uC644\uC131\uB41C \uD504\uB85C\uC81D\uD2B8\uB97C \uBC30\uD3EC\uD574 \uBCF4\uACA0\uC2B5\uB2C8\uB2E4.", startTime: 135, endTime: 141.2 }
    ];
    scenes = [
      { chapterName: "\uAC1C\uBC1C \uD658\uACBD \uBC0F \uD504\uB85C\uC81D\uD2B8 \uAD6C\uC870 \uC18C\uAC1C", time: 0, description: "\uAC15\uC758 \uC2DC\uC791, IDE \uD654\uBA74 \uACF5\uC720 \uBC0F \uC8FC\uC694 \uD3F4\uB354 \uC124\uBA85" },
      { chapterName: "\uC885\uC18D\uC131 \uC124\uCE58 \uBC0F \uAE30\uBCF8 \uBAA8\uB4C8 \uAD6C\uC131", time: 13.2, description: "\uD328\uD0A4\uC9C0 \uB9E4\uB2C8\uC800\uB85C \uAC1C\uBC1C\uC6A9 \uBAA8\uB4C8 \uC124\uCE58 \uBC0F \uCD08\uAE30\uD654 \uCF54\uB529" },
      { chapterName: "\uC911\uC694 \uD575\uC2EC \uBE44\uC988\uB2C8\uC2A4 \uB85C\uC9C1 \uC791\uC131", time: 30.5, description: "\uD575\uC2EC \uB77C\uC774\uBE0C\uB7EC\uB9AC \uBC0F API \uCEE8\uD2B8\uB864\uB7EC \uAD6C\uD604" },
      { chapterName: "\uB514\uBC84\uAE45 \uBC0F \uC608\uC678 \uCC98\uB9AC \uAC00\uC774\uB4DC", time: 58, description: "\uC784\uC2DC \uB514\uBC84\uAC70 \uC911\uB2E8\uC810 \uC124\uC815 \uBC0F \uBC1C\uC0DD \uC5D0\uB7EC \uCF54\uB4DC \uAD50\uC815" },
      { chapterName: "\uD074\uB77C\uC774\uC5B8\uD2B8 \uC0AC\uC774\uB4DC \uD654\uBA74 \uC124\uACC4 \uBC0F \uC5F0\uB3D9", time: 78.4, description: "\uD504\uB860\uD2B8\uC5D4\uB4DC \uC5F0\uB3D9 \uBC0F \uBC30\uD3EC \uC900\uBE44 \uC2AC\uB77C\uC774\uB4DC" }
    ];
  } else {
    topic = "\uBC94\uC6A9 \uD559\uC2B5/\uC77C\uBC18 \uB3D9\uC601\uC0C1";
    sentences = [
      { text: "\uBC18\uAC11\uC2B5\uB2C8\uB2E4! \uC624\uB298\uB3C4 \uC54C\uCC2C \uB0B4\uC6A9\uC73C\uB85C \uC601\uC0C1\uC744 \uC900\uBE44\uD588\uC2B5\uB2C8\uB2E4.", startTime: 2, endTime: 6.8 },
      { text: "\uAE30\uBCF8\uC801\uC778 \uC804\uCCB4 \uAD6C\uC870\uB97C \uBA3C\uC800 \uC2DC\uC57C\uC5D0 \uB2F4\uACE0 \uCD9C\uBC1C\uD574 \uBCF4\uC8E0.", startTime: 8.5, endTime: 13.2 },
      { text: "\uAC00\uC7A5 \uBE48\uBC88\uD558\uAC8C \uC624\uD574\uD558\uB294 \uD3EC\uC778\uD2B8 \uC911 \uD558\uB098\uB97C \uC9DA\uC5B4 \uB4DC\uB9AC\uACA0\uC2B5\uB2C8\uB2E4.", startTime: 18.2, endTime: 23.5 },
      { text: "\uBC14\uB85C \uC774 \uC2DC\uC810\uBD80\uD130 \uC8FC\uC704 \uC0C1\uD669\uC774 \uAE09\uACA9\uD788 \uBC14\uB00C\uAE30 \uC2DC\uC791\uD558\uB294\uB370\uC694.", startTime: 34, endTime: 39.5 },
      { text: "\uAD00\uB828\uD574\uC11C \uCD94\uAC00\uB85C \uC0B4\uD3B4\uBCFC \uD558\uC704 \uD56D\uBAA9\uC740 \uB2E4\uC74C\uACFC \uAC19\uC2B5\uB2C8\uB2E4.", startTime: 48.1, endTime: 53 },
      { text: "\uC2E4\uC81C \uD604\uC5C5\uC774\uB098 \uC2E4\uC0DD\uD65C\uC5D0\uC11C \uC790\uC8FC \uC4F0\uC774\uB294 \uC6D0\uB9AC\uB97C \uC751\uC6A9\uD55C \uAE30\uBC95\uC785\uB2C8\uB2E4.", startTime: 65.4, endTime: 71.2 },
      { text: "\uC911\uAC04 \uC815\uB9AC\uB97C \uC704\uD574\uC11C \uC7A0\uAE50 \uC0DD\uAC01\uD558\uB294 \uC2DC\uAC04\uC744 \uAC00\uC838\uBCF4\uACA0\uC2B5\uB2C8\uB2E4.", startTime: 85, endTime: 90.5 },
      { text: "\uC9C0\uAE08 \uD654\uBA74\uC5D0 \uBCF4\uC774\uB294 \uC601\uC5ED\uC774 \uAC00\uC7A5 \uC8FC\uBAA9\uD574\uC57C \uD560 \uD558\uC774\uB77C\uC774\uD2B8 \uBD80\uBD84\uC785\uB2C8\uB2E4.", startTime: 110.2, endTime: 116.8 },
      { text: "\uC774\uB807\uAC8C \uD55C \uB2E8\uACC4\uC529 \uC21C\uCC28\uC801\uC73C\uB85C \uB530\uB77C\uC624\uC2DC\uB2E4 \uBCF4\uBA74 \uC5B4\uB290\uC0C8 \uB9C8\uC2A4\uD130\uD558\uAC8C \uB429\uB2C8\uB2E4.", startTime: 135.5, endTime: 142.1 },
      { text: "\uB3C4\uC6C0\uC774 \uB418\uC168\uB2E4\uBA74 \uAD6C\uB3C5\uACFC \uC54C\uB9BC \uC124\uC815\uB3C4 \uD568\uAED8 \uBD80\uD0C1\uB4DC\uB9BD\uB2C8\uB2E4. \uC624\uD504\uB2DD \uB05D!", startTime: 162, endTime: 168.5 }
    ];
    scenes = [
      { chapterName: "\uB3D9\uC601\uC0C1 \uC8FC\uC81C \uC18C\uAC1C\uC640 \uD559\uC2B5 \uBAA9\uD45C \uC124\uC815", time: 0, description: "\uAC1C\uC694 \uC124\uBA85 \uBC0F \uC624\uB298\uC758 \uC8FC\uC694 \uC758\uC81C \uBC0F \uD0A4\uC6CC\uB4DC \uBE0C\uB9AC\uD551" },
      { chapterName: "\uD575\uC2EC \uAC1C\uB150 \uC124\uBA85\uACFC \uC2DC\uB098\uB9AC\uC624 \uBD84\uC11D", time: 15.5, description: "PPT \uD310\uC11C \uD544\uAE30 \uC704\uC8FC\uC758 \uD575\uC2EC \uAC1C\uB150\uACFC \uC0C1\uC138 \uC6D0\uB9AC \uD574\uC124" },
      { chapterName: "\uD604\uC7A5 \uC0AC\uB840\uC640 \uC2E4\uC99D \uC790\uB8CC \uC2DC\uBBAC\uB808\uC774\uC158", time: 45, description: "\uC678\uBD80 \uC774\uBBF8\uC9C0, \uCC28\uD2B8 \uC790\uB8CC, \uC2DC\uBC94 \uC601\uC0C1 \uBD84\uC11D \uD654\uBA74" },
      { chapterName: "\uC2EC\uD654 \uC694\uC57D \uBC0F \uC9D1\uC911 \uCCB4\uD06C\uD3EC\uC778\uD2B8 \uBD84\uC11D", time: 95.2, description: "\uAC00\uC7A5 \uBE48\uBC88\uD55C \uC2E4\uC218 \uC720\uD615 \uBC0F \uC815\uB2F5 \uAC00\uC774\uB4DC \uD074\uB7A8\uD504" },
      { chapterName: "\uCD5C\uC885 \uC544\uC6C3\uD2B8\uB85C \uBC0F \uB2E4\uC74C \uC9C4\uB3C4 \uC548\uB0B4", time: 148, description: "\uB9AC\uBDF0 \uD034\uC988 \uB9C8\uBB34\uB9AC \uBC0F \uAC15\uC758 \uC885\uB8CC \uD654\uBA74" }
    ];
  }
  const baselineMax = 175;
  const ratio = duration / baselineMax;
  sentences = sentences.map((s) => {
    const scaledStart = s.startTime * ratio;
    const scaledEnd = s.endTime * ratio;
    const sStart = Math.min(scaledStart, duration - 1.5);
    const sEnd = Math.min(scaledEnd, duration);
    return {
      text: s.text,
      startTime: Number(sStart.toFixed(1)),
      endTime: Number(Math.max(sStart + 1, sEnd).toFixed(1))
    };
  }).filter((s) => s.startTime < s.endTime);
  scenes = scenes.map((sc) => {
    const scaledTime = sc.time * ratio;
    const scTime = Math.min(scaledTime, duration - 0.5);
    return {
      chapterName: sc.chapterName,
      time: Number(scTime.toFixed(1)),
      description: sc.description
    };
  }).filter((sc) => sc.time < duration);
  if (sentences.length === 0) {
    const segs = Math.max(2, Math.floor(duration / 10));
    for (let i = 0; i < segs; i++) {
      const step = duration / segs;
      sentences.push({
        text: `\uC790\uB3D9 \uD6C8\uB828 \uBC18\uBCF5 \uAD6C\uAC04 [\uD30C\uD2B8 ${i + 1}]`,
        startTime: Number((i * step).toFixed(1)),
        endTime: Number(((i + 0.8) * step).toFixed(1))
      });
    }
  }
  if (scenes.length === 0) {
    scenes.push({
      chapterName: "\uB2E8\uC77C \uCC55\uD130 \uC804\uCCB4 \uBCF4\uAE30",
      time: 0,
      description: "\uB3D9\uC601\uC0C1 \uC804\uCCB4 \uC7AC\uC0DD \uAD6C\uAC04 \uB2E8\uC77C \uCC55\uD130"
    });
  }
  return { topic, sentences, scenes };
}
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json());
  app.get("/api/youtube-meta", async (req, res) => {
    try {
      const videoId = req.query.videoId;
      if (!videoId) {
        return res.status(400).json({ error: "videoId is required" });
      }
      const apiKey = process.env.YOUTUBE_API_KEY || "AIzaSyA3dXC8mF32ItPvd5wUDBt-uUWZvonvY5Q";
      const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${encodeURIComponent(videoId)}&key=${apiKey}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`YouTube API returned status ${response.status}`);
      }
      const data = await response.json();
      if (!data.items || data.items.length === 0) {
        return res.status(404).json({ error: "Video not found or is private" });
      }
      const item = data.items[0];
      const title = item.snippet?.title || "Unknown Title";
      const channelTitle = item.snippet?.channelTitle || "Unknown Channel";
      const imgObj = item.snippet?.thumbnails?.high || item.snippet?.thumbnails?.medium || item.snippet?.thumbnails?.default;
      const thumbnail = imgObj?.url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      const durationStr = item.contentDetails?.duration || "";
      const durationRegex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
      const matches = durationStr.match(durationRegex);
      let durationSeconds = 0;
      if (matches) {
        const hours = parseInt(matches[1] || "0", 10);
        const minutes = parseInt(matches[2] || "0", 10);
        const seconds = parseInt(matches[3] || "0", 10);
        durationSeconds = hours * 3600 + minutes * 60 + seconds;
      }
      return res.json({
        title,
        channelTitle,
        thumbnail,
        duration: durationSeconds || 300
      });
    } catch (error) {
      console.error("Error backend fetching YouTube meta:", error.message);
      const videoId = req.query.videoId;
      return res.json({
        title: "YouTube Video",
        channelTitle: "YouTube Media Link",
        thumbnail: videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : "",
        duration: 300,
        isFallback: true
      });
    }
  });
  app.get("/api/youtube-search", async (req, res) => {
    try {
      const query = req.query.q;
      if (!query) {
        return res.status(400).json({ error: "q is required" });
      }
      const apiKey = process.env.YOUTUBE_API_KEY || "AIzaSyA3dXC8mF32ItPvd5wUDBt-uUWZvonvY5Q";
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(query)}&maxResults=10&key=${apiKey}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`YouTube Search API returned status ${response.status}`);
      }
      const data = await response.json();
      const items = (data.items || []).map((item) => {
        const titleRaw = item.snippet?.title || "Unknown Title";
        const title = titleRaw.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
        return {
          id: item.id?.videoId || "",
          title,
          channelTitle: item.snippet?.channelTitle || "YouTube Channel",
          thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || ""
        };
      }).filter((item) => item.id !== "");
      return res.json({ items });
    } catch (error) {
      console.error("Error backend YouTube search:", error.message);
      return res.status(500).json({ error: error.message, items: [] });
    }
  });
  app.get("/api/youtube-subtitles", async (req, res) => {
    const videoId = req.query.videoId;
    if (!videoId) {
      return res.status(400).json({ error: "videoId is required", subtitles: [] });
    }
    try {
      let captions = [];
      try {
        captions = await (0, import_youtube_captions_scraper.getSubtitles)({
          videoID: videoId,
          lang: "ko"
        });
      } catch (koErr) {
        console.log(`Failed ko subtitles for ${videoId}, trying default/en...`);
        try {
          captions = await (0, import_youtube_captions_scraper.getSubtitles)({
            videoID: videoId,
            lang: "en"
          });
        } catch (enErr) {
          console.log(`Failed both ko/en subtitles for ${videoId}`);
        }
      }
      if (captions && captions.length > 0) {
        const list = captions.map((c) => ({
          start: parseFloat(c.start) || 0,
          text: c.text ? c.text.trim() : ""
        }));
        return res.json({ subtitles: list, videoId });
      } else {
        return res.json({
          subtitles: [
            { start: 0, text: "\uC548\uB155\uD558\uC138\uC694! \uD574\uB2F9 \uC601\uC0C1\uC740 \uC720\uD29C\uBE0C \uACF5\uC2DD \uB300\uC678 \uC790\uB9C9 \uC11C\uBE44\uC2A4\uAC00 \uBE44\uD65C\uC131\uD654\uB41C \uC0DD\uD0DC\uC785\uB2C8\uB2E4 \u{1F507}" },
            { start: 10, text: "\uD558\uC9C0\uB9CC \uC624\uB978\uCABD \uC544\uB798 [\uCD94\uCC9C \uB9AC\uC2A4\uD2B8]\uC5D0\uC11C \uB2E4\uB978 \uC601\uC5B4 \uD68C\uD654 \uAC15\uC88C\uB098 \uCF54\uB529 \uC601\uC0C1\uC744 \uACE0\uB974\uC2DC\uBA74 \uC2E4\uC81C \uC720\uD29C\uBE0C\uC5D0\uC11C \uC790\uB9C9\uC744 \uC2E4\uC2DC\uAC04\uC73C\uB85C \uBB34\uD55C \uCD94\uCD9C\uD569\uB2C8\uB2E4 \u{1F31F}" },
            { start: 30, text: "\uAD6C\uAC04\uBC18\uBCF5 \uD559\uC2B5 \uB3C4\uC911\uC5D0 \uC6D0\uD558\uB294 \uC790\uB9C9 \uBB38\uC7A5\uC744 \uC120\uD0DD\uD558\uC5EC \uC790\uB9C9 GOTO\uB97C \uB20C\uB7EC\uC8FC\uC2DC\uBA74 \uADF8 \uC989\uC2DC \uD574\uB2F9 \uC2DC\uAC04\uC73C\uB85C \uC774\uB3D9\uD569\uB2C8\uB2E4." },
            { start: 60, text: "\uADF8 \uBC16\uC5D0 \uC0C1\uB2E8 \uAC80\uC0C9 \uCF58\uC194\uC774\uB098 \uC8FC\uC18C \uC785\uB825\uC744 \uD65C\uC6A9\uD574 \uB2E4\uB978 \uACE0\uD488\uC9C8\uC758 \uC601\uC0C1 \uD559\uC2B5\uC744 \uC2DC\uB3C4\uD574 \uBCF4\uC138\uC694!" }
          ],
          videoId,
          isNoSubtitleFallback: true
        });
      }
    } catch (e) {
      console.warn("Subtitles error, sending fallback list:", e.message);
      return res.json({
        subtitles: [
          { start: 0, text: "[\uC548\uB0B4] \uC774 \uC601\uC0C1\uC5D0\uB294 \uC790\uB3D9 \uCD94\uCD9C\uC774 \uC9C0\uC5F0\uB418\uAC70\uB098 \uC81C\uACF5\uB418\uC9C0 \uC54A\uB294 \uC790\uB9C9 \uAD6C\uC870\uC785\uB2C8\uB2E4." }
        ],
        videoId,
        isNoSubtitleFallback: true
      });
    }
  });
  async function fetchTranscript(videoId) {
    if (!videoId) return "";
    try {
      const captions = await (0, import_youtube_captions_scraper.getSubtitles)({
        videoID: videoId,
        lang: "en"
      });
      if (captions && captions.length > 0) {
        return captions.map((c) => `[${parseFloat(c.start).toFixed(1)}s] ${c.text.trim()}`).join("\n");
      }
    } catch (errEn) {
      console.log(`Failed to fetch EN subtitles for ${videoId}, trying KO...`);
      try {
        const captionsKo = await (0, import_youtube_captions_scraper.getSubtitles)({
          videoID: videoId,
          lang: "ko"
        });
        if (captionsKo && captionsKo.length > 0) {
          return captionsKo.map((c) => `[${parseFloat(c.start).toFixed(1)}s] ${c.text.trim()}`).join("\n");
        }
      } catch (errKo) {
        console.log(`Failed to fetch KO subtitles for ${videoId}.`);
      }
    }
    return "";
  }
  app.post("/api/gemini/analyze-video", async (req, res) => {
    try {
      const { videoId, videoTitle, duration } = req.body;
      if (!videoTitle) {
        return res.status(400).json({ error: "videoTitle is required" });
      }
      const durSec = parseFloat(duration) || 300;
      if (process.env.GEMINI_API_KEY) {
        console.log(`Analyzing video "${videoTitle}" (ID: ${videoId}) using Gemini API...`);
        const ai = new import_genai.GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
          httpOptions: {
            headers: {
              "User-Agent": "aistudio-build"
            }
          }
        });
        const transcriptText = await fetchTranscript(videoId);
        let prompt = "";
        if (transcriptText) {
          console.log(`Successfully fetched real transcript logs for video ${videoId}. Infusing into Gemini...`);
          prompt = `You are an expert AI video analyst for language training and education.
We have a YouTube video:
- Title: "${videoTitle}"
- Video ID: "${videoId || "unknown"}"
- Duration: ${durSec} seconds.

Actual Spoken Transcript with Timestamps:
---
${transcriptText.slice(0, 9500)}
---

Based on this real transcript log containing actual words and timestamps, extract exactly 8 to 15 key educative study spoken phrases in Korean (\uD55C\uAD6D\uC5B4) - or adapted/Korean translation representational text if originally spoken in English - that occur in this video.
CRITICAL CONSTRAINT: Use the exact timestamps from the transcript to set the "startTime" and "endTime" properties!
- Each sentence's "startTime" and "endTime" must reflect where they actually speak those words in the provided transcript.
- For each sentence, startTime MUST be strictly less than endTime (i.e. startTime < endTime).
- Consecutive sentences MUST be strictly progressive and non-overlapping (i.e. sentence[i].startTime >= sentence[i-1].endTime).
- Spacing should be sequential and cover from near 0 up to duration (${durSec}s) nicely.

Also, generate a sequential "scenes" list of 4 to 6 logical visual screen slide or chapter theme transitions throughout the video with Korean explanations. Set their timing matching major points in the transcript.

Return the result in valid JSON matching the requested schema exactly.`;
        } else {
          console.log(`No transcript available for video ${videoId}. Generating simulated ranges...`);
          prompt = `You are an expert AI video analyst for language training and education.
We have a YouTube video:
- Title: "${videoTitle}"
- Video ID: "${videoId || "unknown"}"
- Duration: ${durSec} seconds.

Analyze the video's context from its title and generate sequential, non-overlapping educational segments for language/topic training.

Generate two structural attributes:
1. "sentences": List of exactly 8 to 15 study spoken phrases in Korean (\uD55C\uAD6D\uC5B4) distributed evenly and chronologically.
   CRITICAL CONSTRAINT: Each sentence segment's startTime must represent a forward progress timeline.
   - The list must cover the entire range from near 0 up to duration (${durSec}s) evenly and linearly (e.g. 1st sentence starts early, last sentence finishes near the end of ${durSec}s).
   - For each sentence, startTime MUST be strictly less than endTime (i.e. startTime < endTime).
   - Consecutive sentences MUST be strictly progressive and non-overlapping (i.e. sentence[i].startTime >= sentence[i-1].endTime).
2. "scenes": List of 4 to 6 sequential chapter visual screen slide transitions evenly spaced across ${durSec} seconds, with short visual explanations in Korean.

All results must be returned in valid JSON matching the requested schema exactly.`;
        }
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: import_genai.Type.OBJECT,
              properties: {
                topic: { type: import_genai.Type.STRING, description: "\uC758\uBBF8 \uC788\uB294 \uB3D9\uC601\uC0C1 \uD559\uC2B5 \uCE74\uD14C\uACE0\uB9AC \uC8FC\uC81C" },
                sentences: {
                  type: import_genai.Type.ARRAY,
                  items: {
                    type: import_genai.Type.OBJECT,
                    properties: {
                      text: { type: import_genai.Type.STRING, description: "\uB9D0\uD22C\uB098 \uD45C\uD604\uC774 \uD3EC\uD568\uB41C \uC2E4\uC81C \uD575\uC2EC \uD55C\uAD6D\uC5B4 \uB610\uB294 \uC601\uC5B4 \uBB38\uC7A5" },
                      startTime: { type: import_genai.Type.NUMBER, description: "\uBB38\uC7A5\uC758 \uC2DC\uC791 \uC2DC\uC810 (\uCD08)" },
                      endTime: { type: import_genai.Type.NUMBER, description: "\uBB38\uC7A5\uC758 \uC885\uB8CC \uC2DC\uC810 (\uCD08)" }
                    },
                    required: ["text", "startTime", "endTime"]
                  }
                },
                scenes: {
                  type: import_genai.Type.ARRAY,
                  items: {
                    type: import_genai.Type.OBJECT,
                    properties: {
                      chapterName: { type: import_genai.Type.STRING, description: "\uC7A5\uBA74\uC758 \uCC55\uD130 \uAD6C\uBD84 \uC81C\uBAA9" },
                      time: { type: import_genai.Type.NUMBER, description: "\uC7A5\uBA74 \uC804\uD658\uC774 \uAC10\uC9C0\uB41C \uCD08 \uC624\uD504\uC14B" },
                      description: { type: import_genai.Type.STRING, description: "\uC7A5\uBA74 \uCEF4\uD4E8\uD130 \uBE44\uC804 \uBD84\uC11D \uBC0F \uC2AC\uB77C\uC774\uB4DC \uC694\uC57D \uC124\uBA85" }
                    },
                    required: ["chapterName", "time", "description"]
                  }
                }
              },
              required: ["topic", "sentences", "scenes"]
            }
          }
        });
        if (response.text) {
          const parsed = JSON.parse(response.text.trim());
          if (parsed && Array.isArray(parsed.sentences)) {
            let cleanSentences = parsed.sentences.map((s) => {
              const rawStart = typeof s.startTime === "number" ? s.startTime : parseFloat(s.startTime) || 0;
              const rawEnd = typeof s.endTime === "number" ? s.endTime : parseFloat(s.endTime) || 0;
              let start = Math.max(0, Math.min(rawStart, rawEnd));
              let end = Math.max(rawStart, rawEnd);
              if (end <= start) {
                end = start + 3;
              }
              return {
                text: typeof s.text === "string" ? s.text.trim() : "\uC790\uB3D9 \uBC18\uBCF5 \uAD6C\uAC04 \uD559\uC2B5",
                startTime: start,
                endTime: end
              };
            });
            cleanSentences.sort((a, b) => a.startTime - b.startTime);
            for (let i = 0; i < cleanSentences.length; i++) {
              let current = cleanSentences[i];
              if (current.startTime >= durSec) {
                current.startTime = Math.max(0, durSec - 3);
              }
              if (i > 0) {
                const prevEnd = cleanSentences[i - 1].endTime;
                if (current.startTime < prevEnd) {
                  current.startTime = prevEnd + 0.3;
                }
              }
              if (current.endTime <= current.startTime) {
                current.endTime = current.startTime + 2.5;
              }
              if (current.endTime > durSec) {
                current.endTime = durSec;
                if (current.startTime >= current.endTime) {
                  current.startTime = Math.max(0, current.endTime - 1.5);
                }
              }
              current.startTime = Number(current.startTime.toFixed(1));
              current.endTime = Number(current.endTime.toFixed(1));
            }
            parsed.sentences = cleanSentences.filter((s) => s.startTime < s.endTime);
          }
          if (parsed && Array.isArray(parsed.scenes)) {
            let cleanScenes = parsed.scenes.map((sc) => {
              const t = typeof sc.time === "number" ? sc.time : parseFloat(sc.time) || 0;
              return {
                chapterName: typeof sc.chapterName === "string" ? sc.chapterName.trim() : "\uC0C8 \uCC55\uD130",
                time: Math.max(0, Math.min(t, durSec - 1)),
                description: typeof sc.description === "string" ? sc.description.trim() : "\uCC55\uD130 \uD654\uBA74 \uC124\uBA85"
              };
            });
            cleanScenes.sort((a, b) => a.time - b.time);
            parsed.scenes = cleanScenes.map((sc) => ({
              ...sc,
              time: Number(sc.time.toFixed(1))
            }));
          }
          parsed.isRealAi = true;
          return res.json(parsed);
        }
      }
      console.log("Using smart educational fallback for video analysis.");
      const fallback = generateFallbackAnalysis(videoTitle, durSec);
      return res.json({
        ...fallback,
        isRealAi: false,
        note: "API Key \uBBF8\uB4F1\uB85D \uB610\uB294 \uCD08\uACFC\uB85C \uC784\uC2DC \uC2A4\uB9C8\uD2B8 \uBD84\uC11D \uACB0\uACFC\uB97C \uC0DD\uC131\uD588\uC2B5\uB2C8\uB2E4. \uC2E4\uAC10\uB098\uB294 \uC2A4\uB9C8\uD2B8 \uB85C\uC9C1\uC774 \uC815\uC0C1 \uB3D9\uC791\uD569\uB2C8\uB2E4."
      });
    } catch (err) {
      console.warn("Gemini compilation / parse warning, running fallback:", err.message);
      const fallback = generateFallbackAnalysis(req.body.videoTitle || "\uC720\uD29C\uBE0C \uB3D9\uC601\uC0C1", parseFloat(req.body.duration) || 300);
      return res.json({
        ...fallback,
        isRealAi: false,
        errorMsg: err.message
      });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
