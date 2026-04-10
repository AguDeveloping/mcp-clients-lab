import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const log = (...args: unknown[]) => console.log("[CLIENT]", ...args);

async function main() {
  // ─────────────────────────────────────────────
  // STEP 1 — Create the transport
  // This spawns index.ts as a child process and wires its stdin/stdout
  // as the JSON-RPC channel — exactly what Claude Desktop does.
  // ─────────────────────────────────────────────
  log("STEP 1 | Spawning MCP server as child process (bun src/index.ts)");
  const transport = new StdioClientTransport({
    command: "bun",
    args: ["src/index.ts"],
  });

  // ─────────────────────────────────────────────
  // STEP 2 — Create the client and connect
  // ─────────────────────────────────────────────
  log("STEP 2 | Creating MCP client and connecting to server");
  const client = new Client(
    { name: "hello-world-client", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);
  log("STEP 2 | Connected!");

  // ─────────────────────────────────────────────
  // STEP 3 — Ask the server: what tools do you have?
  // This sends the tools/list JSON-RPC message.
  // ─────────────────────────────────────────────
  log("STEP 3 | Sending tools/list request →");
  const { tools } = await client.listTools();
  log("STEP 3 | ← Server replied with tools:");
  for (const tool of tools) {
    log(`         • ${tool.name} — ${tool.description}`);
  }

  // ─────────────────────────────────────────────
  // STEP 4 — Call a tool
  // We pick the first tool and ask the server to run it.
  // This sends the tools/call JSON-RPC message.
  // ─────────────────────────────────────────────
  const filename = "data/hello.md";
  log(`STEP 4 | Sending tools/call → read_local_file { filename: "${filename}" }`);
  const result = await client.callTool({
    name: "read_local_file",
    arguments: { filename },
  });

  log("STEP 4 | ← Server returned result:");
  for (const item of result.content as { type: string; text: string }[]) {
    log(`         ${item.text}`);
  }

  // ─────────────────────────────────────────────
  // STEP 5 — Clean up
  // ─────────────────────────────────────────────
  log("STEP 5 | Closing connection");
  await client.close();
  log("DONE   | Client finished.");
}

main().catch((error) => {
  console.error("[CLIENT] Fatal error:", error);
  process.exit(1);
});
