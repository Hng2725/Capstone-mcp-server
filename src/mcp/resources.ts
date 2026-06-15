import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { 
  ReadResourceRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ErrorCode, 
  McpError 
} from "@modelcontextprotocol/sdk/types.js";
import { Task } from "../models/Task.js";
import { getOrSetCache } from "../services/redis.js";

export const registerResources = (server: Server) => {
  // KHAI BÁO DANH SÁCH RESOURCES TĨNH
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: "system://project-guidelines",
          name: "Quy tắc dự án",
          mimeType: "text/markdown",
          description: "Đọc các quy tắc quản lý dự án nội bộ"
        }
      ]
    };
  });

  // KHAI BÁO DANH SÁCH RESOURCES ĐỘNG (URI TEMPLATES)
  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
    return {
      resourceTemplates: [
        {
          uriTemplate: "projects://{projectId}/tasks",
          name: "Danh sách Task của Dự án",
          mimeType: "application/json",
          description: "Lấy toàn bộ công việc thuộc về một dự án cụ thể"
        }
      ]
    };
  });

  // ĐỌC THỰC TẾ (Xử lý khi AI yêu cầu đọc URI)
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;

    // Xử lý Static Resource
    if (uri === "system://project-guidelines") {
      return {
        contents: [{
          uri,
          mimeType: "text/markdown",
          text: "# Quy tắc Dự án\n1. Luôn cập nhật trạng thái khi làm xong.\n2. Các task HIGH priority phải được làm trước."
        }]
      };
    }

    // Xử lý Dynamic Resource (URI Templates) - Đã tích hợp Redis Caching
    const match = uri.match(/^projects:\/\/([^/]+)\/tasks$/);
    if (match) {
      const projectId = match[1]!;
      const cacheKey = `tasks_project_${projectId}`;

      // SỬ DỤNG INTELLIGENT CACHING: Lưu bộ nhớ đệm 30 giây
      // Nếu có trong Redis -> Lấy ngay lập tức. Nếu không -> Gọi MongoDB rồi lưu lại.
      const tasks = await getOrSetCache(cacheKey, 30, async () => {
        return await Task.find({ projectId });
      });

      return {
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify(tasks, null, 2)
        }]
      };
    }

    // Nếu AI gọi một URI không nằm trong danh sách hỗ trợ
    throw new McpError(ErrorCode.InvalidRequest, `URI Tài nguyên không hợp lệ: ${uri}`);
  });
};