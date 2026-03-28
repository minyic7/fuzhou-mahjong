import express from "express";
import type { HealthResponse } from "@fuzhou-mahjong/shared";

const app = express();
const PORT = process.env.PORT || 7701;

app.get("/api/health", (_req, res) => {
  const response: HealthResponse = {
    status: "ok",
    timestamp: new Date().toISOString(),
  };
  res.json(response);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
