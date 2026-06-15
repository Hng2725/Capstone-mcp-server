import express from "express";
import cors from "cors";
import "dotenv/config";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { connectDB } from "./config/database.js";
import { createMcpServer } from "./mcp/index.js";
import { startWorker } from "./services/backgroundQueue.js";

const app = express();
// Chú ý: Bỏ express.json() theo kinh nghiệm bài "Bảo mật MCP" để tránh treo luồng stream MCP
app.use(cors());

const mcpServer = createMcpServer();
let sseTransport: SSEServerTransport | null = null;

async function startServer() {
  await connectDB(); // Kết nối MongoDB trước

  startWorker(); // Khởi động Worker xử lý Background Jobs

  // Xác định luồng chạy dựa trên biến môi trường hoặc tham số
  const transportMode = process.env.TRANSPORT_MODE || "stdio";

  if (transportMode === "sse") {
    // Luồng 1: HTTP/SSE (Dùng cho API Đám mây / Inspector)
    app.get("/sse", async (req, res) => {
      sseTransport = new SSEServerTransport("/messages", res);
      await mcpServer.connect(sseTransport);
      console.error("Client SSE đã kết nối");
    });

    app.post("/messages", async (req, res) => {
      if (sseTransport) {
        await sseTransport.handlePostMessage(req, res);
      } else {
        res.status(400).send("Chưa có kết nối SSE");
      }
    });

    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.error(`MCP Cloud Server đang chạy trên cổng ${port} (SSE)`);
    });

  } else {
    // Luồng 2: STDIO (Dùng cho Claude Desktop/Cursor)
    const stdioTransport = new StdioServerTransport();
    await mcpServer.connect(stdioTransport);
    console.error("MCP Local Server đang chạy qua luồng Stdio");
  }
}

startServer().catch(console.error);