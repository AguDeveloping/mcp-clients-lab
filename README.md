# mcp-clients-lab

A hands-on learning lab for the **Model Context Protocol (MCP)** — exploring both server and client patterns using TypeScript, Bun, and Docker.

---

## What is MCP?

MCP (Model Context Protocol) is an open standard that lets AI assistants talk to external tools and data sources in a structured way. You write a server that exposes **tools**, and any MCP client (Claude Desktop, GitHub Copilot, or your own code) can call those tools through a standardized JSON-RPC protocol.

---

## What this repo covers

### 1. Your own MCP server (`src/index.ts`)
A minimal server that exposes one tool: `read_local_file`. Teaches the server-side lifecycle — declare tools, handle calls, connect via stdio transport.

### 2. MCP clients (`src/clients/`)

| Client | Server | What it does |
|---|---|---|
| `client.ts` | your `index.ts` | reads `src/hello.md` — both sides in one command |
| `client-playwright.ts` | `mcp/playwright` (Docker) | navigates Google, saves a screenshot |
| `client-mongodb.ts` | `mcp/mongodb` (Docker) | queries cards collection, syncs tools catalogue |
| `client-github.ts` | `ghcr.io/github/github-mcp-server` (Docker) | lists GitHub repositories |

---

## The core pattern

Every client follows the same 5 steps regardless of which server it connects to:

```
STEP 1 — Create transport   (stdio: spawn process or docker run)
STEP 2 — Connect client     (JSON-RPC handshake)
STEP 3 — listTools()        (discover what the server can do)
STEP 4 — callTool()         (do it)
STEP 5 — close()            (container stops and removes itself)
```

---

## Transport modes

**stdio — you control the server (local dev)**
```ts
new StdioClientTransport({ command: "bun", args: ["src/index.ts"] })
new StdioClientTransport({ command: "docker", args: ["run", "-i", "--rm", "mcp/mongodb"] })
```

**HTTP — server is already running (next step)**
```ts
new StreamableHTTPClientTransport(new URL("http://localhost:3000/mcp"))
```

The client code above STEP 1 is identical in both cases.

---

## Key insight

```
"dependencies": {
  "@modelcontextprotocol/sdk": "^1.29.0"   ← only this
}
```

No MongoDB driver. No Playwright package. No GitHub SDK. The servers live in Docker images — your code only speaks the protocol. Infrastructure complexity moves outside your project.

---

## Prerequisites

- [Bun](https://bun.sh) v1.3.7+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) with MCP Toolkit

---

## Running the clients

```bash
# Your own server
bun src/client.ts

# Playwright (Docker pulls image on first run)
bun src/clients/client-playwright.ts

# MongoDB (requires local MongoDB running)
bun src/clients/client-mongodb.ts

# GitHub (requires token in .env.development.local)
bun --env-file=.env.development.local src/clients/client-github.ts
```

---

## Environment

Create `.env.development.local`:
```
GITHUB_PERSONAL_ACCESS_TOKEN=ghp_yourtoken
```

---

## The Docker lifecycle

```
bun src/clients/client-mongodb.ts
  │
  ├── docker run -i --rm mcp/mongodb   ← container starts
  │     └── JSON-RPC over stdin/stdout
  │
  └── client.close()                   ← container stops and is removed (--rm)
```

Ephemeral by design. Each run gets a clean server instance.

---

## Architecture note

The MCP client is the **adapter layer** in hexagonal architecture. Your domain logic calls a port interface. The adapter behind it speaks MCP to a Docker container. Swap the container, keep the domain unchanged.

```
Domain (your rules)
  └── Port interface
        └── MCP adapter  →  docker run mcp/anything
```

> The protocol is the contract. Your skills go inside the handlers.
