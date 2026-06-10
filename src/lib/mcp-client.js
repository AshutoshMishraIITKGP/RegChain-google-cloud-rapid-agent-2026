import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

let mcpClient = null;
let mcpTransport = null;

export async function getMCPClient() {
  if (mcpClient) {
    return mcpClient;
  }

  const mcpUrl = process.env.ELASTIC_MCP_URL;
  const apiKey = process.env.ELASTIC_API_KEY;

  if (!mcpUrl || !apiKey) {
    throw new Error('ELASTIC_MCP_URL and ELASTIC_API_KEY must be set in environment variables');
  }

  mcpTransport = new StreamableHTTPClientTransport(new URL(mcpUrl), {
    requestInit: {
      headers: {
        Authorization: `ApiKey ${apiKey}`
      }
    }
  });

  mcpClient = new Client({
    name: "regchain-backend",
    version: "1.0.0"
  }, {
    capabilities: {}
  });

  await mcpClient.connect(mcpTransport);
  return mcpClient;
}

export async function closeMCPClient() {
  if (mcpTransport) {
    await mcpTransport.close();
    mcpTransport = null;
    mcpClient = null;
  }
}

// Wrapper function to execute a tool on the Elastic MCP server
export async function executeElasticMCPTool(toolName, args) {
  const client = await getMCPClient();
  const response = await client.callTool({
    name: toolName,
    arguments: args
  });
  
  if (response.isError) {
    throw new Error(`Elastic MCP Tool '${toolName}' returned error: ${response.content.map(c => c.text).join(', ')}`);
  }
  
  // Try parsing the text content assuming JSON
  try {
    const rawText = response.content.map(c => c.text).join('\n');
    return JSON.parse(rawText);
  } catch (e) {
    return response.content.map(c => c.text).join('\n');
  }
}
