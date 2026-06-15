import Anthropic from '@anthropic-ai/sdk';
import type { ITask } from '../models/Task.js';

// Lazy load Anthropic client - chỉ khởi tạo khi cần dùng
let anthropic: Anthropic | null = null;

const getAnthropicClient = () => {
  if (!anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
    }
    anthropic = new Anthropic({ apiKey });
  }
  return anthropic;
};

export const analyzeTasksRisk = async (tasks: ITask[], projectContext: string): Promise<string> => {
  if (!tasks || tasks.length === 0) return "Không có dữ liệu công việc để phân tích.";

  const prompt = `
  Bạn là một chuyên gia Quản lý Dự án (Project Manager).
  Dưới đây là danh sách các công việc hiện tại của dự án:
  ${JSON.stringify(tasks, null, 2)}
  
  Ngữ cảnh người dùng yêu cầu: ${projectContext}
  
  Hãy phân tích rủi ro của dự án này dựa trên tỷ lệ task 'TODO' và 'HIGH' priority. 
  Trả về một báo cáo tóm tắt ngắn gọn, chuyên nghiệp bằng tiếng Việt.
  `;

  try {
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }]
    });

    const first = response?.content?.[0];
    if (!first) return "Lỗi đọc dữ liệu AI.";
    return first.type === 'text' && typeof first.text === 'string' ? first.text : "Lỗi đọc dữ liệu AI.";
  } catch (error) {
    console.error("Lỗi khi gọi Anthropic API:", error);
    throw new Error("Không thể phân tích dữ liệu AI vào lúc này.");
  }
};