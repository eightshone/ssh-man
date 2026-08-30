import { Client } from "ssh2";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { VERSION } from "../../utils/consts";
import { server as serverConfig } from "../../utils/types";
import execCommand from "../functions/sshExec";
import {
  readRemoteFile,
  writeRemoteFile,
  listRemoteDirectory,
} from "../functions/sshSftp";
import ShellSession from "../functions/sshShellSession";

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function errorResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

function buildMcpServer(client: Client, sshConfig: serverConfig): McpServer {
  const mcp = new McpServer({ name: "sshman", version: VERSION });
  const shellSession = new ShellSession();

  mcp.registerResource(
    "connection-info",
    "connection://info",
    { description: "Metadata about the connected ssh server" },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify({
            name: sshConfig.name,
            host: sshConfig.host,
            port: sshConfig.port,
            username: sshConfig.username,
          }),
        },
      ],
    }),
  );

  mcp.registerTool(
    "run_command",
    {
      description: "Run a shell command on the connected ssh server and return its stdout, stderr, and exit code.",
      inputSchema: {
        command: z.string().describe("The command to execute"),
        cwd: z.string().optional().describe("Working directory to run the command from"),
      },
    },
    async ({ command, cwd }) => {
      try {
        const result = await execCommand(client, command, { cwd });
        return textResult(JSON.stringify(result));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  mcp.registerTool(
    "read_file",
    {
      description: "Read a text file from the connected ssh server.",
      inputSchema: {
        path: z.string().describe("Absolute or relative remote path"),
      },
    },
    async ({ path }) => {
      try {
        const content = await readRemoteFile(client, path);
        return textResult(content);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  mcp.registerTool(
    "write_file",
    {
      description: "Write a text file to the connected ssh server, overwriting it if it already exists.",
      inputSchema: {
        path: z.string().describe("Absolute or relative remote path"),
        content: z.string().describe("Content to write"),
      },
    },
    async ({ path, content }) => {
      try {
        await writeRemoteFile(client, path, content);
        return textResult(`Wrote ${content.length} bytes to ${path}`);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  mcp.registerTool(
    "list_directory",
    {
      description: "List the contents of a directory on the connected ssh server.",
      inputSchema: {
        path: z.string().describe("Absolute or relative remote path"),
      },
    },
    async ({ path }) => {
      try {
        const entries = await listRemoteDirectory(client, path);
        return textResult(JSON.stringify(entries));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  mcp.registerTool(
    "start_shell",
    {
      description: "Start a persistent interactive shell session on the connected ssh server.",
    },
    async () => {
      try {
        await shellSession.start(client);
        return textResult("Shell session started.");
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  mcp.registerTool(
    "send_input",
    {
      description: "Send input to the running interactive shell session (call start_shell first).",
      inputSchema: {
        input: z.string().describe("Text to write to the shell's stdin, include a trailing \\n to submit a line"),
      },
    },
    async ({ input }) => {
      try {
        shellSession.write(input);
        return textResult("Input sent.");
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  mcp.registerTool(
    "read_shell_output",
    {
      description: "Read output the interactive shell session has produced since the last read.",
    },
    async () => {
      try {
        return textResult(shellSession.readOutput());
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  mcp.registerTool(
    "close_shell",
    {
      description: "Close the interactive shell session.",
    },
    async () => {
      try {
        shellSession.close();
        return textResult("Shell session closed.");
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  return mcp;
}

export default buildMcpServer;
