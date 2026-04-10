# MCP Server — How it works

## The core idea

An MCP server is a process that speaks a **standardized protocol** (Model Context Protocol) so any AI client (Claude Desktop, GitHub Copilot, etc.) can discover and call its tools without knowing anything about the implementation inside.

The SDK handles the protocol. You write the tools.

---

## What the SDK gives you (the fixed contract)

| Piece | Role |
|---|---|
| `Server` | JSON-RPC engine — routes incoming messages to your handlers |
| `StdioServerTransport` | Wire layer — reads from `stdin`, writes to `stdout` |
| `ListToolsRequestSchema` | Protocol message: client asks *"what tools do you have?"* |
| `CallToolRequestSchema` | Protocol message: client says *"run this tool with these args"* |

This part **never changes** regardless of what your server does.

---

## What you write (your content)

Everything else is yours to invent:

- **Tool declaration** — a name, description, and input schema (what the AI sees)
- **Tool handler** — the actual logic (file read, DB query, API call, anything)
- **Data** — the files, services, or systems your tools expose

In this example:
- Tool declared: `read_local_file`
- Handler: reads a file from the filesystem with `fs.readFile`
- Data: `src/hello.md`

You could replace the `fs.readFile` with a database query tomorrow and the protocol layer would not change at all.

---

## The lifecycle

```
bun src/index.ts

  STEP 1 — Server object created (identity + capabilities declared)
  STEP 2 — Tool catalogue registered (what tools exist)
  STEP 3 — Execution handler registered (what tools do)
  STEP 4 — Transport connected, process blocks on stdin

       ↓ waiting for a client to connect ↓

  EVENT  ← tools/list    client asks for the catalogue
  EVENT  → tools list    server responds with [read_local_file]

  EVENT  ← tools/call    client calls read_local_file { filename: "src/hello.md" }
  ACTION   reads the file from disk
  EVENT  → file content  server returns the text to the client
```

The process runs as a child process spawned by the AI client. Communication happens through the stdin/stdout pipes using JSON-RPC messages. Logs go to `stderr` to keep the protocol channel clean.

---

## Mental model

> **The protocol is the contract. Your skills go inside the handlers.**

The AI client does not care how you implemented the tool — it only speaks MCP. This is what makes the architecture composable: any client can use any MCP server, and any server can expose any capability.
