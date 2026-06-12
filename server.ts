import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API to fetch YouTube Video Metadata securely
  app.get("/api/youtube-meta", async (req, res) => {
    try {
      const videoId = req.query.videoId as string;
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

      return res.json({
        title,
        channelTitle,
        thumbnail,
        duration: durationSeconds || 300,
      });

    } catch (error: any) {
      console.error("Error backend fetching YouTube meta:", error.message);
      // Clean fallback response
      const videoId = req.query.videoId as string;
      return res.json({
        title: "YouTube Video",
        channelTitle: "YouTube Media Link",
        thumbnail: videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : "",
        duration: 300,
        isFallback: true,
      });
    }
  });

  // API to search YouTube videos securely
  app.get("/api/youtube-search", async (req, res) => {
    try {
      const query = req.query.q as string;
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
      const items = (data.items || []).map((item: any) => {
        const titleRaw = item.snippet?.title || "Unknown Title";
        // Simple HTML entity decode for titles
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

      return res.json({ items });
    } catch (error: any) {
      console.error("Error backend YouTube search:", error.message);
      return res.status(500).json({ error: error.message, items: [] });
    }
  });

  // Serve static files in production, use Vite middleware in development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
