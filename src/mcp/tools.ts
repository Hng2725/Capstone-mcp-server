import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema, 
  ErrorCode, 
  McpError 
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { Task } from "../models/Task.js";
import { taskQueue } from "../services/backgroundQueue.js";
import { invalidateCache } from "../services/redis.js";
import { analyzeTasksRisk } from "../services/aiAnalyzer.js";

// Zod Schemas
const CreateTaskSchema = z.object({
  title: z.string().min(5, "Tiêu đề phải có ít nhất 5 ký tự"),
  projectId: z.string(),
  assigneeId: z.string(),
  priority: z.enum(["HIGH", "NORMAL", "LOW"]).default("NORMAL"),
});

const UpdateTaskSchema = z.object({
  taskId: z.string(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]),
});

const AnalyzeProjectSchema = z.object({
  projectId: z.string().min(1, "Thiếu Project ID"),
  focusArea: z.string().default("tổng thể dự án").describe("Trọng tâm phân tích (ví dụ: rủi ro, tiến độ)")
});

export const registerTools = (server: Server) => {
  // KHAI BÁO DANH SÁCH TOOLS (Liệt kê các Tool cho Client)
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "create_task",
          description: "Tạo một công việc (task) mới vào dự án",
          inputSchema: {
            type: "object",
            properties: {
              title: { type: "string", description: "Tiêu đề công việc" },
              projectId: { type: "string", description: "ID của dự án" },
              assigneeId: { type: "string", description: "ID người được giao" },
              priority: { type: "string", enum: ["HIGH", "NORMAL", "LOW"] }
            },
            required: ["title", "projectId", "assigneeId"]
          }
        },
        {
          name: "update_task_status",
          description: "Cập nhật trạng thái của công việc",
          inputSchema: {
            type: "object",
            properties: {
              taskId: { type: "string", description: "ID của task cần cập nhật" },
              status: { type: "string", enum: ["TODO", "IN_PROGRESS", "DONE"] }
            },
            required: ["taskId", "status"]
          }
        },
        {
          name: "analyze_project",
          description: "Sử dụng AI nội bộ để phân tích toàn bộ công việc của một dự án và đưa ra báo cáo rủi ro.",
          inputSchema: {
            type: "object",
            properties: {
              projectId: { type: "string", description: "Mã dự án cần phân tích" },
              focusArea: { type: "string", description: "Bạn muốn tập trung phân tích khía cạnh nào?" }
            },
            required: ["projectId"]
          }
        }
      ]
    };
  });

  // THỰC THI TOOLS (Xử lý khi AI gọi Tool)
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      if (request.params.name === "create_task") {
        const data = CreateTaskSchema.parse(request.params.arguments);
        const newTask = await Task.create(data);

        // BẮN JOB VÀO HÀNG ĐỢI (Không bắt client phải đợi)
        await taskQueue.add('send-creation-notice', {
            taskId: newTask._id.toString(),
            action: 'CREATED',
            assigneeId: data.assigneeId
        }, {
            attempts: 3, // Thử lại 3 lần nếu có lỗi
            backoff: { type: 'exponential', delay: 1000 } // Chiến thuật đợi nhân đôi: 1s, 2s, 4s...
        });

        // XÓA CACHE
        await invalidateCache(`tasks_project_${data.projectId}`);
        return { content: [{ type: "text", text: `Đã tạo task thành công: ${newTask._id}` }] };
      }

      if (request.params.name === "update_task_status") {
        const data = UpdateTaskSchema.parse(request.params.arguments);
        const updated = await Task.findByIdAndUpdate(data.taskId, { status: data.status }, { new: true });
        if (!updated) throw new McpError(ErrorCode.InvalidParams, "Không tìm thấy Task ID");
        return { content: [{ type: "text", text: `Đã cập nhật trạng thái thành: ${updated.status}` }] };
      }

      if (request.params.name === "analyze_project") {
        const data = AnalyzeProjectSchema.parse(request.params.arguments);
        
        // 1. Kéo dữ liệu từ Database
        const tasks = await Task.find({ projectId: data.projectId });
        
        if (tasks.length === 0) {
          return { content: [{ type: "text", text: `Dự án ${data.projectId} chưa có công việc nào.` }] };
        }

        // 2. Giao cho AI Service phân tích dữ liệu
        console.error(`Đang kích hoạt Claude AI nội bộ để phân tích dự án ${data.projectId}...`);
        const analysisReport = await analyzeTasksRisk(tasks, data.focusArea);

        // 3. Trả kết quả đã được "tiêu hóa" về cho Client
        return { content: [{ type: "text", text: analysisReport }] };
      }

      throw new McpError(ErrorCode.MethodNotFound, `Tool không tồn tại: ${request.params.name}`);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        throw new McpError(ErrorCode.InvalidParams, `Dữ liệu đầu vào sai: ${error.issues.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  });
};