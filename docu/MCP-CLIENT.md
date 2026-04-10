# MCP Client — How it works

## The core idea

An MCP client connects to an MCP server, asks what tools it has, and calls them.  
The SDK makes a cross-process protocol call feel like a local function call.

---

## What the client does (4 steps)

```
1. Create a transport   → defines HOW to reach the server
2. Connect              → establishes the JSON-RPC channel
3. listTools()          → asks the server "what can you do?"
4. callTool()           → tells the server "do it"
```

---

## The two transport modes

**stdio — you own the server (local dev)**
```ts
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "bun",
  args: ["src/index.ts"],   // SDK spawns the server as a child process
});
```

**HTTP — someone else runs the server (Docker, cloud)**
```ts
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const transport = new StreamableHTTPClientTransport(
  new URL("http://localhost:3000/mcp")   // server is already running
);
```

The rest of the client code is **identical** in both cases.

---

## Key insight

> The server you killed with Ctrl+C was irrelevant.  
> The client always spawns (stdio) or connects to (HTTP) its own server instance.  
> You never manage the server lifecycle manually.

---

## What the SDK hides from you

Without it you would write:
- `child_process.spawn` manually
- JSON-RPC request serialization
- response ID matching
- error and timeout handling

With it you just write:
```ts
const { tools } = await client.listTools();
const result    = await client.callTool({ name: "read_local_file", arguments: { filename } });
```

Two lines. The protocol disappears.
