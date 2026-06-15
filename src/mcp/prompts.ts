import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { 
  GetPromptRequestSchema, 
  ListPromptsRequestSchema, 
  ErrorCode, 
  McpError 
} from "@modelcontextprotocol/sdk/types.js";

export const registerPrompts = (server: Server) => {
  // KHAI BÁO DANH SÁCH PROMPTS
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: [
        {
          name: "scrum_master_review",
          description: "Yêu cầu AI đóng vai Scrum Master để đánh giá dự án",
          arguments: [
            {
              name: "projectId",
              description: "ID của dự án cần đánh giá",
              required: true
            }
          ]
        }
      ]
    };
  });

  // THỰC THI PROMPT (Khi AI gọi tới prompt này)
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    if (request.params.name === "scrum_master_review") {
      const projectId = request.params.arguments?.projectId;
      if (!projectId) throw new McpError(ErrorCode.InvalidParams, "Thiếu tham số projectId");

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Bạn là một Scrum Master cực kỳ khắt khe. Hãy sử dụng Resource URI "projects://${projectId}/tasks" để đọc danh sách công việc. Hãy đánh giá tiến độ và nhắc nhở nghiêm khắc những công việc đang bị đình trệ.`
            }
          }
        ]
      };
    }

    throw new McpError(ErrorCode.MethodNotFound, "Prompt không tồn tại");
  });
};