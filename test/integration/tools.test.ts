import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerTools } from '../../src/mcp/tools.js';
import { Task } from '../../src/models/Task.js';
import mongoose from 'mongoose';
import 'dotenv/config';

// Mock Queue
vi.mock('../../src/services/backgroundQueue.js', () => ({
  taskQueue: { add: vi.fn() }
}));
vi.mock('../../src/services/redis.js', () => ({
  invalidateCache: vi.fn()
}));

import { taskQueue } from '../../src/services/backgroundQueue.js';

describe('MCP Tools Integration (Real Database & Protocol)', () => {
  let server: Server;
  let client: Client;
  let serverTransport: InMemoryTransport;
  let clientTransport: InMemoryTransport;

  beforeAll(async () => {
    // 1. Kết nối MongoDB Thật
    const uri = process.env.MONGODB_URI_TEST || process.env.MONGODB_URI || 'mongodb://localhost:27017/mcp_capstone_test';
    await mongoose.connect(uri);
    
    // 2. Setup Server
    server = new Server(
      { name: "test-server", version: "1.0" }, 
      { capabilities: { tools: {} } }
    );
    registerTools(server);

    // 3. Setup Luồng giao tiếp nội bộ trong RAM (InMemory)
    // InMemoryTransport tạo ra một cặp ống nước ảo nối trực tiếp với nhau
    [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    // 4. Setup Client (Đóng vai Claude)
    client = new Client(
      { name: "test-client", version: "1.0.0" }, 
      { capabilities: {} }
    );

    // 5. CHO CHÚNG KẾT NỐI & ĐÀM PHÁN (Handshake)
    await server.connect(serverTransport);
    await client.connect(clientTransport);
  });

  afterEach(async () => {
    await Task.deleteMany({});
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await clientTransport.close();
    await serverTransport.close();
    await mongoose.connection.close();
  });

  // --- CÁC TEST CASE DÙNG CLIENT CHUẨN ---

  it('Tool create_task phải lưu thực sự vào Database và gọi Queue', async () => {
    // Dùng client.callTool thay vì server.request
    const response = await client.callTool({
      name: "create_task",
      arguments: {
        title: "Test Task Thật",
        projectId: "PROJ-1",
        assigneeId: "USER-1"
      }
    });

    expect((response as any).content[0].text).toContain('Đã tạo task thành công');
    
    const tasksInDb = await Task.find({ projectId: "PROJ-1" });
    expect(tasksInDb.length).toBe(1);
    expect(tasksInDb[0]!.title).toBe("Test Task Thật");
    
    expect(taskQueue.add).toHaveBeenCalled();
  });

  it('Tool update_task_status phải đổi trạng thái trong Database thật', async () => {
    const seedTask = await Task.create({
      title: "Task Cần Sửa",
      projectId: "PROJ-2",
      assigneeId: "USER-2",
      status: "TODO"
    });

    const response = await client.callTool({
      name: "update_task_status",
      arguments: {
        taskId: seedTask._id.toString(),
        status: "DONE"
      }
    });

    expect((response as any).content[0].text).toContain('Đã cập nhật trạng thái thành: DONE');

    const checkTask = await Task.findById(seedTask._id);
    expect(checkTask?.status).toBe("DONE");
  });

  it('Tool create_task phải bắn lỗi nếu truyền sai tham số (Zod Validation)', async () => {
    // Bắt lỗi khi client gọi Tool sai cấu trúc
    await expect(client.callTool({
      name: "create_task", 
      arguments: { projectId: "PROJ-1" } // Cố tình truyền thiếu title
    })).rejects.toThrow();
    
    const count = await Task.countDocuments();
    expect(count).toBe(0);
  });
});