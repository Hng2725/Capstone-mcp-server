import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import mongoose from 'mongoose';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { createMcpServer } from '../../src/mcp/index.js';
import 'dotenv/config';

describe('E2E: Real SSE Transport & MCP Protocol', () => {
  let httpServer: any;
  let mcpClient: Client;
  let clientTransport: SSEClientTransport;

  // 1. KHỞI TẠO SERVER & CLIENT THẬT TRƯỚC KHI TEST
  beforeAll(async () => {
    // Kết nối Database thật (dành cho môi trường test)
    const uri = process.env.MONGODB_URI_TEST || process.env.MONGODB_URI || 'mongodb://localhost:27017/mcp_test';
    await mongoose.connect(uri);

    // Bật một Express Server chạy ngầm ở Port 3001 (để tránh đụng Port 3000 chính)
    const app = express();
    const mcpServer = createMcpServer();
    let sseTransport: SSEServerTransport | null = null;

    app.get('/sse', async (req, res) => {
      sseTransport = new SSEServerTransport('/messages', res);
      await mcpServer.connect(sseTransport);
    });

    app.post('/messages', async (req, res) => {
      if (sseTransport) await sseTransport.handlePostMessage(req, res);
    });

    await new Promise<void>((resolve) => {
      httpServer = app.listen(3001, () => resolve());
    });

    // KHỞI TẠO CLIENT THẬT: Đóng vai Claude Desktop kết nối vào cổng 3001
    clientTransport = new SSEClientTransport(new URL('http://localhost:3001/sse'));
    mcpClient = new Client(
      { name: "test-claude-client", version: "1.0.0" }, 
      { capabilities: {} }
    );
    
    // Mở luồng kết nối SSE thực sự qua mạng
    await mcpClient.connect(clientTransport);
  });

  // 2. DỌN DẸP, ĐÓNG CỔNG MẠNG SAU KHI TEST XONG
  afterAll(async () => {
    await clientTransport.close(); // Đóng luồng SSE của Client
    await new Promise((resolve) => httpServer.close(resolve)); // Tắt Express Server
    await mongoose.connection.close(); // Ngắt Database
  });

  // 3. CÁC KỊCH BẢN TEST E2E QUA MẠNG
  it('Client thật phải kết nối được SSE và lấy đúng danh sách Tools', async () => {
    // Client gửi gói tin JSON-RPC qua HTTP POST /messages thật sự
    const response = await mcpClient.listTools();
    
    expect(response.tools).toBeDefined();
    expect(response.tools.length).toBeGreaterThan(0);
    
    // Kiểm tra xem tool "analyze_project" (AI) có được Server trả về mạng không
    const toolNames = response.tools.map(t => t.name);
    expect(toolNames).toContain('analyze_project');
    expect(toolNames).toContain('create_task');
  });

  it('Client thật gọi Tool đọc Resource tĩnh thành công qua mạng', async () => {
    const response = await mcpClient.readResource({
      uri: "system://project-guidelines"
    });

    expect(response.contents).toBeDefined();
    expect((response.contents[0] as any).text).toContain('Quy tắc Dự án');
  });
});