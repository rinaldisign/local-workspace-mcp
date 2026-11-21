import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as svc from './lib/fs-service.js';

function ok(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function fail(error) {
  const message = error instanceof svc.HttpError
    ? `${error.status}: ${error.message}`
    : `Error: ${error?.message || String(error)}`;
  return { content: [{ type: 'text', text: message }], isError: true };
}

function register(server, name, description, shape, handler) {
  const wrapped = async (args) => {
    try {
      return ok(await handler(args || {}));
    } catch (error) {
      return fail(error);
    }
  };

  if (typeof server.registerTool === 'function') {
    server.registerTool(name, { description, inputSchema: shape }, wrapped);
  } else {
    server.tool(name, description, shape, wrapped);
  }
}

export function buildServer() {
  const server = new McpServer(
    { name: 'local-workspace-mcp', version: '1.0.0' },
    {
      instructions:
        'Local code workspace. Use save_code/create_tree to write files. ' +
        'All paths are relative to the workspace root. HTML -> pages/, CSS -> styles/, JS -> scripts/.',
      capabilities: { tools: {} }
    }
  );

  register(
    server,
    'workspace_info',
    'Workspace info: absolute path, file size limit, allowed extensions, and folder category mapping.',
    {},
    () => svc.workspaceInfo()
  );

  register(
    server,
    'list_files',
    'List folders and files in the workspace (recursive, bounded).',
    { path: z.string().optional().describe('Relative folder path. Empty = workspace root.') },
    ({ path }) => svc.listTree(path || '')
  );

  register(
    server,
    'read_file',
    'Read the contents of one text file from the workspace.',
    { path: z.string().describe('Relative file path, e.g. pages/index.html') },
    ({ path }) => svc.readFile(path)
  );

  register(
    server,
    'write_file',
    'Write/create a file at an explicit relative path. Overwrites existing files. Parent folders are created automatically. Atomic write.',
    {
      path: z.string().describe('Relative file path, e.g. scripts/app.js'),
      content: z.string().describe('Full file contents')
    },
    ({ path, content }) => svc.writeFile(path, content)
  );

  register(
    server,
    'save_code',
    'Save code into an automatic category folder based on language/extension (html->pages, css->styles, js->scripts).',
    {
      name: z.string().describe('File name, with or without extension, e.g. index or main.js'),
      content: z.string().describe('Full file contents'),
      language: z.string().optional().describe('html | css | js | json | md | ...'),
      folder: z.string().optional().describe('Override destination folder, e.g. pages/admin')
    },
    ({ name, content, language, folder }) => {
      const relPath = svc.suggestRelativePath(name, language, folder);
      return svc.writeFile(relPath, content);
    }
  );

  register(
    server,
    'edit_file',
    'Edit part of a file: replace old text with new text. Fails when oldText is missing or appears more than once (unless replaceAll=true).',
    {
      path: z.string().describe('Relative file path'),
      oldText: z.string().describe('Exact text to find'),
      newText: z.string().describe('Replacement text (may be empty to delete)'),
      replaceAll: z.boolean().optional().describe('true = replace every occurrence')
    },
    ({ path, oldText, newText, replaceAll }) => svc.editFile(path, oldText, newText, replaceAll === true)
  );

  register(
    server,
    'create_tree',
    'Create a folder + file structure at once from a list of entries. Good for project scaffolding.',
    {
      entries: z
        .array(
          z.object({
            path: z.string().describe('Relative path'),
            type: z.enum(['file', 'dir']).optional().describe('Default: file'),
            content: z.string().optional().describe('File contents (for type=file)')
          })
        )
        .describe('Entry list, max 200')
    },
    ({ entries }) => svc.createStructure(entries)
  );

  register(
    server,
    'create_folder',
    'Create one folder (recursive).',
    { path: z.string().describe('Relative folder path') },
    ({ path }) => svc.createFolder(path)
  );

  register(
    server,
    'move_path',
    'Move or rename a file/folder.',
    {
      from: z.string().describe('Source path'),
      to: z.string().describe('Destination path')
    },
    ({ from, to }) => svc.movePath(from, to)
  );

  register(
    server,
    'delete_path',
    'Delete a file or folder (recursive). Careful: there is no undo.',
    { path: z.string().describe('Relative path to delete') },
    ({ path }) => svc.deletePath(path)
  );

  register(
    server,
    'search_files',
    'Search for text inside workspace files.',
    {
      query: z.string().describe('Text to search for'),
      path: z.string().optional().describe('Limit the search to this folder'),
      maxResults: z.number().optional().describe('Default 50, max 200')
    },
    ({ query, path, maxResults }) => svc.searchFiles(query, path || '', maxResults)
  );

  return server;
}
