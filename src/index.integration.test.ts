import { describe, test, expect, afterEach } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// Spawns the MCP server as a child process and connects a real MCP client to it.
// This validates the full request/response cycle over stdio without mocking.

describe("hello-world MCP server", () => {
  let client: Client;
  let transport: StdioClientTransport;

  async function connect() {
    transport = new StdioClientTransport({
      command: "bun",
      args: ["src/index.ts"],
    });

    client = new Client(
      { name: "test-client", version: "1.0.0" },
      { capabilities: {} }
    );

    await client.connect(transport);
  }

  afterEach(async () => {
    await client?.close();
  });

  test("lists the read_local_file tool", async () => {
    await connect();

    const { tools } = await client.listTools();

    expect(tools).toHaveLength(1);
    expect(tools[0]?.name).toBe("read_local_file");
    expect(tools[0]?.inputSchema.required).toContain("filename");
  });

  test("reads an existing file", async () => {
    await connect();

    const result: { isError: boolean; content: Array<{ type: string; text: string }> } = await client.callTool({
      name: "read_local_file",
      arguments: { filename: "package.json" },
    }) as any;

    expect(result.isError).toBeFalsy();
    expect(result.content).toHaveLength(1);

    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toContain("mcp-hello-world");
  });

  test("returns an error for a missing file", async () => {
    await connect();

    const result: { isError: boolean; content: Array<{ type: string; text: string }> } = await client.callTool({
      name: "read_local_file",
      arguments: { filename: "does-not-exist.txt" },
    }) as any;

    expect(result.isError).toBe(true);
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toContain("Error reading file");
  });
});
