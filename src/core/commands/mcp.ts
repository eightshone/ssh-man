import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import resolveConnection from "../../utils/resolveConnection";
import init from "../functions/init";
import { connectClient } from "../functions/ssh";
import buildMcpServer from "../mcp/server";

async function mcpCommand(
  creds: string,
  options: { password?: boolean },
) {
  // stdout is reserved for the MCP JSON-RPC stream, so init must stay silent
  const { config } = await init({ silent: true });

  const { sshConfig, error } = await resolveConnection(
    creds,
    config.servers,
    !!options.password,
  );
  if (!sshConfig) {
    console.error(error);
    process.exitCode = 1;
    return;
  }

  let client;
  try {
    client = await connectClient(sshConfig);
  } catch (err) {
    console.error(
      `Failed to connect to ${sshConfig.host}: ${err instanceof Error ? err.message : err}`,
    );
    process.exitCode = 1;
    return;
  }

  const mcp = buildMcpServer(client, sshConfig);
  const transport = new StdioServerTransport();

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    await mcp.close().catch(() => {});
    client.end();
    process.exit(0);
  };

  client.on("close", shutdown);
  client.on("error", (err) => {
    console.error(`SSH connection error: ${err.message}`);
    shutdown();
  });
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await mcp.connect(transport);
}

export default mcpCommand;
