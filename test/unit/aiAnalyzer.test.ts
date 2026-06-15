import { describe, it, expect } from 'vitest';
import { analyzeTasksRisk } from '../../src/services/aiAnalyzer.js';
import dotenv from 'dotenv';

// Load .env file trước khi chạy test
dotenv.config();

describe('AI Analyzer Service (Gọi API Thật)', () => {
  
  it('Phải trả về thông báo mặc định nếu danh sách Task rỗng (Không gọi API)', async () => {
    const result = await analyzeTasksRisk([], 'Phân tích chung');
    expect(result).toBe("Không có dữ liệu công việc để phân tích.");
  });

  // Tăng timeout lên 30 giây (30000ms) vì gọi API thật tốn thời gian
  it('Phải gọi Anthropic API thật và trả về báo cáo đánh giá', async () => {
    // 1. Chuẩn bị dữ liệu đầu vào
    const mockTasks: any = [
      { title: 'Fix bug bảo mật đăng nhập', priority: 'HIGH', status: 'TODO' },
      { title: 'Viết tài liệu API', priority: 'NORMAL', status: 'IN_PROGRESS' }
    ];
    
    // 2. Thực thi hàm (Nó sẽ bốc máy gọi lên Claude thực sự)
    const result = await analyzeTasksRisk(mockTasks, 'Tìm rủi ro trễ hạn');
    
    // 3. In ra console để bạn tận mắt nhìn thấy Claude trả lời gì trong lúc test
    console.log("Phản hồi thật từ Claude:\n", result);

    // 4. Kiểm thử tính hợp lệ của dữ liệu trả về
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(20); // Báo cáo phải có độ dài nhất định
    
    // Note: Dùng toMatch thay vì toBe vì nội dung sinh ra là ngẫu nhiên
    expect(result.toLowerCase()).toMatch(/task|công việc|rủi ro|todo|high/);
    
  }, 30000); // <-- Quan trọng: Timeout 30 giây

});