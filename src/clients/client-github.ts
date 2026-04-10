// bun --env-file=.env.development.local src/clients/client-github.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const log = (...args: unknown[]) => console.log("[CLIENT]", ...args);

// ─────────────────────────────────────────────
// Token is read from the environment (loaded via .env.development.local).
// Never hardcode tokens in source files.
// ─────────────────────────────────────────────
const GITHUB_TOKEN = process.env.GITHUB_PERSONAL_ACCESS_TOKEN || "not available";
if (!GITHUB_TOKEN || GITHUB_TOKEN.startsWith("ghp_XXX")) {
  console.error("[CLIENT] ERROR: Set a real GITHUB_PERSONAL_ACCESS_TOKEN in .env.development.local");
  process.exit(1);
}

const GITHUB_USERNAME = "AguDeveloping";

async function main() {
  // ─────────────────────────────────────────────
  // STEP 1 — Create the transport
  // Spawns the official GitHub MCP server image via Docker stdio.
  // The Personal Access Token is injected as an env variable — same
  // pattern as mcp/mongodb with MDB_MCP_CONNECTION_STRING.
  // ─────────────────────────────────────────────
  log("STEP 1 | Spawning GitHub MCP server via Docker (ghcr.io/github/github-mcp-server)");
  const transport = new StdioClientTransport({
    command: "docker",
    args: [
      "run", "-i", "--rm",
      "-e", "GITHUB_PERSONAL_ACCESS_TOKEN",
      "ghcr.io/github/github-mcp-server",
    ],
    env: {
      ...process.env,
      GITHUB_PERSONAL_ACCESS_TOKEN: GITHUB_TOKEN,
    },
  });

  // ─────────────────────────────────────────────
  // STEP 2 — Create the client and connect
  // ─────────────────────────────────────────────
  log("STEP 2 | Creating MCP client and connecting to server");
  const client = new Client(
    { name: "github-client", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);
  log("STEP 2 | Connected!");

  // ─────────────────────────────────────────────
  // STEP 3 — List tools
  // ─────────────────────────────────────────────
  log("STEP 3 | Sending tools/list request →");
  const { tools } = await client.listTools();
  log(`STEP 3 | ← Server replied with ${tools.length} tools:`);
  for (const tool of tools) {
    log(`         • ${tool.name} — ${tool.description}`);
  }

  // ─────────────────────────────────────────────
  // STEP 4 — List repositories for AguDeveloping
  // The GitHub MCP server exposes a list_repositories tool that maps
  // directly to the GitHub REST API GET /users/{username}/repos.
  // ─────────────────────────────────────────────
  log(`STEP 4 | Sending tools/call → search_repositories for user "${GITHUB_USERNAME}"`);
  const result = await client.callTool({
    name: "search_repositories",
    arguments: {
      query: `user:${GITHUB_USERNAME}`,
    },
  });

  log(`STEP 4 | ← Repositories returned:`);
  for (const item of result.content as { type: string; text: string }[]) {
    try {
      const parsed = JSON.parse(item.text);
      const repos = parsed.items ?? [];
      log(`         total: ${parsed.total_count} repositories\n`);
      for (const repo of repos) {
        log(`         • [${repo.language ?? "—"}] ${repo.full_name} — ${repo.description ?? ""}`);
      }
    } catch {
      log(`\n${item.text}`);
    }
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
