import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { buildServer } from './mcp-core.js';
import { ensureWorkspace, runtime } from './lib/config.js';

ensureWorkspace();

const server = buildServer();
const transport = new StdioServerTransport();

await server.connect(transport);
console.error(`[local-workspace-mcp] stdio ready. Workspace: ${runtime.workspace}`);
