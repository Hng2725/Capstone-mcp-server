import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { registerTools } from "./tools.js";
import { registerResources } from "./resources.js";
import { registerPrompts } from "./prompts.js";

export const createMcpServer = () => {
  const server = new Server(
    { name: "capstone-project-manager", version: "1.0.0" },
    { capabilities: { tools: {}, resources: {}, prompts: {} } }
  );

  // Đăng ký các module
  registerTools(server);
  registerResources(server);
  registerPrompts(server);

  return server;
};