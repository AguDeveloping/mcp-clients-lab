import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import fs from "fs/promises";
import path from "path";

const log = (...args: unknown[]) => console.log("[CLIENT]", ...args);

const SCREENSHOT_PATH = path.join(process.cwd(), "data", "playwright", "screenshot-google-com.jpg");

async function main() {
  // ─────────────────────────────────────────────
  // STEP 1 — Create the transport
  // Instead of spawning a local .ts file, we tell Docker to run the
  // Playwright MCP image.  The SDK wires Docker's stdin/stdout as the
  // JSON-RPC channel — same mechanism, different command.
  //
  // Equivalent to the config in Docker MCP Toolkit:
  //   { "command": "docker", "args": ["run", "-i", "--rm", "mcp/playwright"] }
  // ─────────────────────────────────────────────
  log("STEP 1 | Spawning Playwright MCP server via Docker (mcp/playwright)");
  const transport = new StdioClientTransport({
    command: "docker",
    args: ["run", "-i", "--rm", "mcp/playwright"],
  });

  // ─────────────────────────────────────────────
  // STEP 2 — Create the client and connect
  // ─────────────────────────────────────────────
  log("STEP 2 | Creating MCP client and connecting to server");
  const client = new Client(
    { name: "playwright-client", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);
  log("STEP 2 | Connected!");

  // ─────────────────────────────────────────────
  // STEP 3 — Ask the server: what tools do you have?
  // Playwright exposes 20+ browser automation tools.
  // ─────────────────────────────────────────────
  log("STEP 3 | Sending tools/list request →");
  const { tools } = await client.listTools();
  log(`STEP 3 | ← Server replied with ${tools.length} tools:`);
  for (const tool of tools) {
    log(`         • ${tool.name} — ${tool.description}`);
  }

  // ─────────────────────────────────────────────
  // STEP 4 — Call a tool: navigate to a URL
  // browser_navigate opens a real Chromium instance inside the container
  // and returns the page title / status.
  // ─────────────────────────────────────────────
  const url = "https://www.google.com";
  log(`STEP 4 | Sending tools/call → browser_navigate { url: "${url}" }`);
  const result = await client.callTool({
    name: "browser_navigate",
    arguments: { url },
  });

  log("STEP 4 | ← Server returned navigate result:");
  for (const item of result.content as { type: string; text: string }[]) {
    log(`         ${item.text}`);
  }

  // ─────────────────────────────────────────────
  // STEP 4b — Take a screenshot
  // browser_take_screenshot returns a base64-encoded PNG/JPEG image.
  // We decode it and write it to a fixed file, overwriting on each run.
  // ─────────────────────────────────────────────
  log("STEP 4b | Sending tools/call → browser_take_screenshot");
  const screenshotResult = await client.callTool({ name: "browser_take_screenshot", arguments: {} });

  const imageItem = (screenshotResult.content as { type: string; data?: string; mimeType?: string }[])
    .find((item) => item.type === "image");

  if (!imageItem?.data) throw new Error("No image data returned from browser_take_screenshot");

  const imageBuffer = Buffer.from(imageItem.data, "base64");
  await fs.mkdir(path.dirname(SCREENSHOT_PATH), { recursive: true });
  await fs.writeFile(SCREENSHOT_PATH, imageBuffer);
  log(`STEP 4b | Screenshot saved → ${SCREENSHOT_PATH}`);

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
