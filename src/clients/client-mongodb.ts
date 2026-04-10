import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { title } from "node:process";

const log = (...args: unknown[]) => console.log("[CLIENT]", ...args);

// ─────────────────────────────────────────────
// Connection string: replace localhost → host.docker.internal
// because "localhost" inside the Docker container refers to the container
// itself, not your Windows host where MongoDB is running.
// host.docker.internal is the Docker Desktop magic hostname that resolves
// to the host machine from within any container.
// ─────────────────────────────────────────────
const CONNECTION_STRING =
  "mongodb://admin:password@host.docker.internal:27017/research-nest-card-db" +
  "?retryWrites=true&loadBalanced=false&serverSelectionTimeoutMS=5000" +
  "&connectTimeoutMS=10000&authSource=admin&authMechanism=SCRAM-SHA-1";

async function main() {
  // ─────────────────────────────────────────────
  // STEP 1 — Create the transport
  // Spawns the MongoDB MCP container via Docker stdio — same pattern as
  // Playwright.  The connection string is injected as an env variable
  // inside the container using the -e flag + env option.
  // ─────────────────────────────────────────────
  log("STEP 1 | Spawning MongoDB MCP server via Docker (mcp/mongodb)");
  const transport = new StdioClientTransport({
    command: "docker",
    args: [
      "run", "-i", "--rm",
      "-e", "MDB_MCP_CONNECTION_STRING",
      "mcp/mongodb",
    ],
    env: {
      ...process.env,  // inherit host env (PATH etc.)
      MDB_MCP_CONNECTION_STRING: CONNECTION_STRING,
    },
  });

  // ─────────────────────────────────────────────
  // STEP 2 — Create the client and connect
  // ─────────────────────────────────────────────
  log("STEP 2 | Creating MCP client and connecting to server");
  const client = new Client(
    { name: "mongodb-client", version: "1.0.0" },
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
  // STEP 4 — Query the cards collection
  // find returns all documents in the collection as JSON.
  // ─────────────────────────────────────────────
  log('STEP 4 | Sending tools/call → find documents in "cards" collection');
  const result = await client.callTool({
    name: "find",
    arguments: {
      collection: "cards",
      database: "research-nest-card-db",
      filter: {},        // empty filter = return all documents
    },
  });

  log("STEP 4 | ← Documents returned:");
  for (const item of result.content as { type: string; text: string }[]) {
    log(`\n${item.text}`);
  }

  // ─────────────────────────────────────────────
  // STEP 4B — Ensure the 'mcp-mongo-tools' collection exists
  // list-collections returns all collections in the database.
  // We check the text response for the collection name.
  // If absent, we create it.
  // ─────────────────────────────────────────────
  log("STEP 4B | Checking if 'mcp-mongo-tools' collection exists...");
  const collectionsResult = await client.callTool({
    name: "list-collections",
    arguments: { database: "research-nest-card-db" },
  });

  const collectionsText = (collectionsResult.content as { type: string; text: string }[])
    .map((item) => item.text).join("\n");

  const collectionExists = collectionsText.includes("mcp-mongo-tools");

  if (!collectionExists) {
    log("STEP 4B | Not found — creating collection 'mcp-mongo-tools'...");
    await client.callTool({
      name: "create-collection",
      arguments: { collection: "mcp-mongo-tools", database: "research-nest-card-db" },
    });
    log("STEP 4B | Collection created.");
  } else {
    log("STEP 4B | Collection already exists — skipping creation.");
  }

  // ─────────────────────────────────────────────
  // STEP 4C — Sync tools catalogue into 'mcp-mongo-tools'
  // If the stored count is lower than the current tools list length,
  // the catalogue is stale: wipe it and re-insert fresh documents.
  // Each document carries: id, name, serverVersion, date.
  // ─────────────────────────────────────────────
  log("STEP 4C | Checking document count in 'mcp-mongo-tools'...");
  const countResult = await client.callTool({
    name: "count",
    arguments: { collection: "mcp-mongo-tools", database: "research-nest-card-db", query: {} },
  });

  const countText = (countResult.content as { type: string; text: string }[])
    .map((item) => item.text).join("\n");

  // The response contains a number somewhere — extract the first integer found
  const countMatch = countText.match(/\d+/);
  const currentCount = countMatch ? parseInt(countMatch[0], 10) : 0;

  log(`STEP 4C | Stored: ${currentCount} docs  |  Available tools: ${tools.length}`);

  if (currentCount < tools.length) {
    log("STEP 4C | Stale — wiping collection and reinserting...");

    await client.callTool({
      name: "delete-many",
      arguments: { collection: "mcp-mongo-tools", database: "research-nest-card-db", filter: {} },
    });
    log("STEP 4C | Collection cleared.");

    const toolDocs = tools.map((tool, index) => ({
      id: index + 1,
      name: tool.name || "unknown",
      description: tool.description || "unknown",
      title: tool.title || "unknown",
      server: "mcp/mongodb",
      version: "1.0.0",
      date: new Date().toISOString(),
    }));

    await client.callTool({
      name: "insert-many",
      arguments: {
        collection: "mcp-mongo-tools",
        database: "research-nest-card-db",
        documents: toolDocs,
      },
    });
    log(`STEP 4C | Inserted ${toolDocs.length} tool documents.`);
  } else {
    log("STEP 4C | Up to date — no changes needed.");
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
