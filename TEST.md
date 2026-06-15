# 📋 Testing Guide

## 🧪 Cấu trúc Test

```
test/
├── unit/           # Unit Tests - Test từng service độc lập
├── integration/    # Integration Tests - Test với DB thật (không qua network)
└── e2e/           # E2E Tests - Test qua HTTP/SSE thật sự
```

---

## 🚀 Cách chạy Test

| Lệnh | Mô tả |
|------|-------|
| `npm test` | Chạy tất cả test (watch mode) |
| `npm test -- --run` | Chạy test 1 lần rồi thoát |
| `npm run test:ui` | Chạy với giao diện UI (browser) |
| `npm test -- test/unit/` | Chỉ chạy unit tests |
| `npm test -- aiAnalyzer.test.ts` | Chạy 1 file cụ thể |

---

## 📁 3 Cấp Độ Test

### 1. Unit Tests (`test/unit/aiAnalyzer.test.ts`)
- **Mục đích**: Test từng hàm/service độc lập
- **Không cần**: Database, Network
- **Ví dụ**:

```typescript
it('Phải trả về thông báo mặc định nếu danh sách Task rỗng', async () => {
  const result = await analyzeTasksRisk([], 'Phân tích chung');
  expect(result).toBe("Không có dữ liệu công việc để phân tích.");
});

it('Phải gọi Anthropic API thật và trả về báo cáo', async () => {
  const result = await analyzeTasksRisk(mockTasks, 'Tìm rủi ro');
  expect(typeof result).toBe('string');
  expect(result.length).toBeGreaterThan(20);
}, 30000); // Timeout 30s vì gọi API thật
```

**⚠️ Lưu ý quan trọng cho Unit Tests:**
- File `.env` phải có `ANTHROPIC_API_KEY` hợp lệ
- **KHÔNG DẤU NGOẶC KÉP** quanh API key:
  ```
  ✅ ĐÚNG: ANTHROPIC_API_KEY=sk-ant-api03-...
  ❌ SAI:  ANTHROPIC_API_KEY="sk-ant-api03-..."
  ```
- Dùng **Lazy Initialization** để tránh lỗi module loading:
  ```typescript
  let anthropic: Anthropic | null = null;
  const getAnthropicClient = () => {
    if (!anthropic) {
      anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
    return anthropic;
  };
  ```

---

### 2. Integration Tests (`test/integration/tools.test.ts`)
- **Mục đích**: Test tích hợp nhiều module với DB thật
- **Không cần**: Network HTTP (dùng InMemoryTransport)
- **Cấu trúc**:

```typescript
// Tạo transport nối trực tiếp trong RAM (không cần HTTP)
[clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
await server.connect(serverTransport);
await client.connect(clientTransport);

// Mock external services (Redis, Queue)
vi.mock('../../src/services/backgroundQueue.js', () => ({
  taskQueue: { add: vi.fn() }
}));

it('Tool create_task phải lưu vào Database thật', async () => {
  const response = await client.callTool({
    name: "create_task",
    arguments: { title: "Test Task", projectId: "PROJ-1" }
  });

  // Kiểm tra DB
  const tasksInDb = await Task.find({ projectId: "PROJ-1" });
  expect(tasksInDb.length).toBe(1);
});
```

---

### 3. E2E Tests (`test/e2e/sse.test.ts`)
- **Mục đích**: Test toàn bộ hệ thống qua network thật
- **Cần**: HTTP Server, MongoDB, SSE Connection

```typescript
// Khởi động Express Server ở port 3001
httpServer = app.listen(3001);

// Client kết nối qua HTTP thật
clientTransport = new SSEClientTransport(new URL('http://localhost:3001/sse'));
await mcpClient.connect(clientTransport);

it('Client thật phải kết nối được SSE', async () => {
  const response = await mcpClient.listTools();
  expect(response.tools).toContain('analyze_project');
});

// Cleanup sau test
afterAll(async () => {
  await clientTransport.close();
  await httpServer.close();
  await mongoose.connection.close();
});
```

---

## 🛠️ Debugging Tips

### Tăng timeout cho test chậm
```typescript
it('Test gọi API', async () => { /* ... */ }, 30000); // 30s
```

### Xem log trong test
```typescript
console.log("Result:", result);
```

### Mock API để tránh chờ
```typescript
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = {
      create: vi.fn().ResolvedValue({ content: [{ text: 'Mock' }] })
    }
  }
}));
```

---

## 📊 Kết Quả Test Hiện Tại

```
✅ test/e2e/sse.test.ts (2 tests) - PASS
✅ test/integration/tools.test.ts (3 tests) - PASS
⚠️  test/unit/aiAnalyzer.test.ts (2 tests) - 1 FAIL
  ✓ Phải trả về thông báo mặc định nếu danh sách Task rỗng
  ❌ Phải gọi Anthropic API thật (cần fix .env)
```

---

## 🎯 Best Practices

1. **AAA Pattern**: Arrange → Act → Assert
2. **Test tên rõ ràng**: `Phải làm X khi Y`
3. **Tách biệt test data**: Không phụ hưởng lẫn nhau
4. **Cleanup**: Dùng `afterEach` / `afterAll` để đóng DB/Server
5. **Mock external services**: Redis, Queue khi không cần test thật
6. **Timeout hợp lý**: 30s cho API, 5s cho local tests

---

## 📝 Checklist Trước Khi Push

- [ ] `npm test` - tất cả pass?
- [ ] Không `console.log` bị bỏ lại
- [ ] Mock external services trong integration tests
- [ ] Cleanup resources trong `afterAll`
- [ ] `.env` không có trong git (đã thêm `.gitignore`)
