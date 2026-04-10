import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema,
  type Tool
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import path from "path";

// All logs go to stderr so they don't pollute the JSON-RPC stdout channel
const log = (...args: unknown[]) => console.error("[MCP]", ...args);

// Define an interface for our tool arguments
interface ReadFileArgs {
  filename: string;
}

// ─────────────────────────────────────────────
// STEP 1 — Create the server object
// This just defines the server identity and which capability groups it supports.
// "tools: {}" means "I advertise tools, but the list comes from the handler below."
// ─────────────────────────────────────────────
log("STEP 1 | Creating server object  (name=hello-world-server, capabilities=[tools])");
const server = new Server(
  { name: "hello-world-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// ─────────────────────────────────────────────
// STEP 2 — Declare the tools catalogue
// An MCP client (e.g. Claude Desktop) sends a "tools/list" request first.
// We respond with every tool we support so the client can decide which to call.
// ─────────────────────────────────────────────
log("STEP 2 | Registering tool definition: read_local_file");
const READ_FILE_TOOL: Tool = {
  name: "read_local_file",
  description: "Read the content of a specific file in the current directory",
  inputSchema: {
    type: "object",
    properties: {
      filename: { type: "string", description: "The name of the file to read" }
    },
    required: ["filename"]
  }
};

// Handler for the "tools/list" request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  log("EVENT  | ← tools/list request received from client");
  log("EVENT  | → responding with tool list:", [READ_FILE_TOOL.name]);
  return { tools: [READ_FILE_TOOL] };
});

// ─────────────────────────────────────────────
// STEP 3 — Handle tool execution
// After the client knows the catalogue it sends a "tools/call" request
// with the tool name + arguments.  We run the logic and return the result.
// ─────────────────────────────────────────────
log("STEP 3 | Registering handler for tool execution (tools/call)");
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  log(`EVENT  | ← tools/call  tool="${name}"  args=${JSON.stringify(args)}`);

  if (name === "read_local_file") {
    // Cast arguments to our interface
    const { filename } = args as unknown as ReadFileArgs;

    const filePath = path.join(process.cwd(), filename);
    log(`ACTION | Reading file at path: ${filePath}`);

    try {
      const content = await fs.readFile(filePath, "utf-8");
      log(`ACTION | File read OK — ${content.length} characters`);
      log(`EVENT  | → returning file content to client`);
      
      return {
        content: [{ type: "text", text: content }]
      };
    } catch (error: any) {
      log(`ERROR  | Could not read file: ${error.message}`);
      log(`EVENT  | → returning error payload to client`);
      return {
        content: [{ type: "text", text: `Error reading file: ${error.message}` }],
        isError: true
      };
    }
  }

  log(`ERROR  | Unknown tool requested: "${name}"`);
  throw new Error(`Tool not found: ${name}`);
});

// ─────────────────────────────────────────────
// STEP 4 — Connect via stdio transport
// StdioServerTransport wires the server to stdin/stdout using JSON-RPC.
// The client process spawns this process and talks to it through those pipes.
// ─────────────────────────────────────────────
async function main() {
  log("STEP 4 | Creating StdioServerTransport (JSON-RPC over stdin/stdout)");
  const transport = new StdioServerTransport();

  log("STEP 4 | Connecting server to transport — waiting for client messages…");
  await server.connect(transport);

  log("READY  | MCP server is live. Listening for requests on stdin.");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});