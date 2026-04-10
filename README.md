# MCP Hello World — Local File Reader

A minimal **Model Context Protocol (MCP)** server written in TypeScript. This is the simplest possible example of how to expose a local tool to an AI agent (like Claude Desktop or Cursor).

---

## What is MCP?

MCP (Model Context Protocol) is an open standard that lets AI assistants talk to external tools and data sources in a structured way. Think of it as a plugin system: you write a server that exposes "tools", and the AI can call those tools during a conversation.

---

## What does this example do?

This server exposes a single tool called `read_local_file`. When an AI agent asks to read a file, the server:

1. Receives the tool call with a `filename` argument.
2. Resolves the path relative to the server's working directory.
3. Reads the file from disk and returns its contents as text.

That's it — intentionally simple so you can see every moving part.

---

## Project structure

```
index.ts       ← the entire MCP server (one file)
package.json
tsconfig.json
```

### Key sections inside `index.ts`

| Section | What it does |
|---------|-------------|
| **Initialize the Server** | Creates an MCP `Server` instance with a name and version, and declares it supports `tools`. |
| **Define the Tools** | Declares the `read_local_file` tool with a JSON Schema so the AI knows what arguments to pass. |
| **Handle Tool Execution** | Reads the requested file with `fs.readFile` and returns the content (or an error message). |
| **Connect** | Wires the server to `StdioServerTransport` so it communicates over standard I/O. |

---

## Prerequisites

- [Bun](https://bun.com) v1.3.7 or higher (used as runtime and package manager)
- An MCP-compatible host: **Claude Desktop** or **Cursor**

---

## Quick start

```bash
# Install dependencies
bun install

# Run the server
bun run index.ts
```

You should see:

```
TypeScript MCP Server running on stdio
```

The server is now listening on `stdio` and ready to be connected to a host.

---

## Connecting to an MCP host

### Cursor

Add the following to your Cursor MCP settings (`.cursor/mcp.json` or the global config):

```json
{
  "mcpServers": {
    "hello-world": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/index.ts"]
    }
  }
}
```

### Claude Desktop

Add it to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "hello-world": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/index.ts"]
    }
  }
}
```

Once connected, the AI can call `read_local_file` with a filename and get back the file contents.

---

## How the tool call works (step by step)

```
AI agent                MCP server (this code)
   |                          |
   |--- ListTools ----------->|  "What tools do you have?"
   |<-- [read_local_file] ----|  "I have this one tool."
   |                          |
   |--- CallTool ------------>|  { name: "read_local_file", arguments: { filename: "README.md" } }
   |<-- { text: "..." } ------|  returns file contents
```

---

## Security note

The server only reads files relative to `process.cwd()` — wherever you launch it from. It does not traverse outside that directory by default, keeping the AI's reach limited to your project folder.
