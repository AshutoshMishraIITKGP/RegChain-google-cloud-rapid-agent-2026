import { GoogleGenAI } from '@google/genai';
import { getElasticClient } from './elastic.js';
import path from 'path';
import { ENTITY_INDEX, RELATIONSHIP_INDEX, NODE_TYPES, EDGE_TYPES } from './constants.js';

let aiClient = null;
function getGenAI() {
  if (!aiClient) {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS);
    }
    aiClient = new GoogleGenAI({});
  }
  return aiClient;
}

const COMMON_PROMPT = `You are RegChain AI, a Senior Compliance Copilot.
You are given a BOUNDED SUBGRAPH retrieved from the knowledge graph based on the user's query.
You must use ONLY this retrieved context to answer the user's question or formulate your suggestions.
Do NOT act like a generic assistant.
NEVER ask the user for Elasticsearch index names, graph structure details, data source names, or internal node IDs.`;

const BUILD_SYSTEM_PROMPT = `${COMMON_PROMPT}

You are an advanced AI Graph Copilot operating in BUILD MODE.
You help users construct, map, and organize their compliance knowledge graph.

CRITICAL INSTRUCTIONS:
1. Always format your textual responses beautifully. Use **bold** for emphasis, *italics* for nuanced terms, and <u>underlines</u> for crucial regulations or node names.
2. If the user's message is just a greeting (e.g. "hey", "hello", "how are you") or a general conversational query that does NOT require changing the graph, respond conversationally and DO NOT output a JSON block.
3. If the user's message clearly implies adding or modifying nodes, infer missing entities and generate a proposal immediately without asking clarifying questions first. (But still if you are not sure about anything then you can ask )
4. If the graph search returns NO relevant nodes but the user is clearly asking for a compliance task, return industry-standard starter recommendations immediately.
5. If the user asks to delete or remove nodes, use the 'proposed_deletions' field to suggest deleting specific EXACT node or edge IDs from the bounded subgraph.
6. NEVER apply changes automatically — only suggest them using the JSON block.
7. WARNING: When proposing new nodes or edges, you MUST ONLY use the following exact Node Types and Edge Types. Do NOT invent new categories!
   - ALLOWED NODE TYPES: ${NODE_TYPES.join(', ')}
   - ALLOWED EDGE TYPES: ${EDGE_TYPES.join(', ')}
8. CRITICAL FOR DELETIONS & MODIFICATIONS: If you are modifying an existing edge (e.g. changing its relationship type), you MUST propose the new edge AND propose the deletion of the old edge to prevent duplicates. You MUST ONLY suggest deleting Edge IDs that you have explicitly retrieved. If you do not know the exact Edge ID of the old edge, use \`platform_core_execute_esql\` to find it (e.g., \`FROM regchain-relationships | WHERE source == "SRC_ID" AND target == "TGT_ID" LIMIT 1\`). DO NOT hallucinate fake IDs!

JSON OUTPUT REQUIREMENT (ONLY FOR GRAPH CHANGES):
When generating suggestions, you MUST append a valid JSON block at the very end of your response:
\`\`\`json
{
  "summary": "Brief summary",
  "reasoning": "Detailed explanation",
  "proposed_nodes": [{"type":"NodeType","name":"Name","description":"...","status":"active","tags":[],"confidence":0.9}],
  "proposed_edges": [{"source_name":"Src","target_name":"Tgt","relation":"edge_type","rationale":"...","confidence":0.9}],
  "proposed_deletions": {"nodes": ["EXACT_NODE_ID_1"], "edges": ["EXACT_EDGE_ID_1"]},
  "changes": [{"action":"add","type":"node","description":"..."}],
  "confidence": 0.85,
  "warnings": ["Any potential issues"]
}
\`\`\`

The visible text part of your response MUST STRICTLY follow this Compliance Review format:

GRAPH REVIEW COMPLETE

EXECUTIVE SUMMARY
[summary]

RECOMMENDED CHANGES
[changes]

IMPACT
[impact]

CONFIDENCE
[confidence]

WARNINGS
[warnings]

ACTIONS
[actions]`;

const ANALYZE_SYSTEM_PROMPT = `${COMMON_PROMPT}

Your role: ANALYZE MODE
- Reason about the existing graph. Explore chains of compliance and assess downstream risk.
- Always format your textual responses beautifully. Use **bold** for emphasis, *italics* for nuanced terms, and <u>underlines</u> for crucial regulations or node names.
- If the user's message is just a greeting (e.g. "hey", "hello") or a general conversational query, respond conversationally and DO NOT output a JSON block.
- For graph analysis queries, ALWAYS use the JSON format with 'metadata' containing 'visited_nodes' and 'visited_edges'.
- If the user asks for suggestions, answer them conceptually, but remind them to switch to BUILD MODE to apply them.
- Analyze the provided BOUNDED SUBGRAPH to trace connections and impacts.

CHAIN OF THOUGHT (MANDATORY):
Before providing your final answer, you MUST enclose your step-by-step reasoning and exploration logic within <thinking> and </thinking> tags. Explain exactly which nodes and relationships from the provided subgraph you are using to draw your conclusion. This is critical for transparency.

CRITICAL FAILURE HANDLING:
If the subgraph is completely empty or irrelevant, you MUST return exactly:
"Graph data unavailable. Risk level cannot be determined. Reason: Graph retrieval failed or returned insufficient data."
NEVER infer "Low Risk" from missing data.

When you finish your analysis, you MUST append a valid JSON block at the very end of your response identifying the exact subgraph you reasoned over:
\`\`\`json
{
  "visited_nodes": ["NODE-ID-1", "NODE-ID-2"],
  "visited_edges": ["EDGE-ID-1"]
}
\`\`\`
IMPORTANT RULES FOR JSON:
1. You MUST include ALL node and edge IDs that were critical to your logical path or analysis chain. If you trace a path from A to B to C, you MUST include the IDs for A, B, and C in the 'visited_nodes' array, not just the starting node!
2. WARNING: NEVER hallucinate IDs from the Chat History! You MUST only use exact IDs that are explicitly present in the CURRENT "FULL KNOWLEDGE GRAPH" provided to you. If you mention an entity, use its exact 'id' field from the graph data.
3. CRITICAL: If you are identifying a "gap" or something missing, DO NOT invent fake IDs for the missing nodes/edges. Instead, your JSON must strictly contain the IDs of the EXISTING nodes and edges that formed the BASIS of your conclusion (i.e., the surrounding context).
4. To traverse the graph effectively:
1. Identify starting nodes using \`platform_core_search\` (index: regchain-entities) based on the user's query keywords.
2. IMPORTANT: You MUST use \`platform_core_execute_esql\` to find relationships between nodes and traverse the graph paths.
   Example ES|QL: FROM regchain-relationships | WHERE source == "NODE-ID" OR target == "NODE-ID"
3. DO NOT rely solely on node descriptions. You must physically invoke the ES|QL tool to verify if edges exist.
4. Extract the exact IDs of any nodes and edges you discover and use them in your final answer.`;

export async function processAIChat(userMessage, history = [], mode = 'build', fileData = null) {
  const ai = getGenAI();

  // --- STAGE 1: QUERY TRANSLATION (gemini-2.5-flash) ---
  let optimizedQuery = userMessage;
  try {
    const translationPrompt = `You are a compliance graph search expert.
The user is asking: "${userMessage}"
Extract the core entities and concepts into a boolean Elasticsearch query string.
Rules:
1. ONLY output the search keywords, nothing else.
2. Use OR to separate concepts (e.g. "KYC OR AML OR vendor").
3. Do not include words like "explore", "find", "connections".
Output only the string:`;
    
    const transRes = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: translationPrompt
    });
    
    const txt = transRes.text.trim().replace(/^['"]|['"]$/g, '');
    if (txt.length > 0) optimizedQuery = txt;
    console.log("[STAGE 1] Translated Query:", optimizedQuery);
  } catch (e) {
    console.warn("[STAGE 1] Translation failed, falling back to raw query.", e);
  }

  // --- STAGE 2: ADK AGENT ORCHESTRATION ---
  let textOutput = '';
  let parsedData = null;
  const visitedNodes = new Set();
  const visitedEdges = new Set();
  
  try {
    const { Agent, Gemini } = await import('@google/adk');
    const { regchainTools } = await import('./agent-tools.js');
    
    // Clear global session tracking before starting
    global._activeToolSession = {
      visitedNodes: new Set(),
      visitedEdges: new Set()
    };

    let historyText = history.length > 0 
      ? "Chat History:\n" + history.map(m => `${m.sender?.toUpperCase() || m.role?.toUpperCase()}: ${m.text || m.content}`).join('\n') + "\n\n"
      : "";

    const systemInstruction = mode === 'build' ? BUILD_SYSTEM_PROMPT : ANALYZE_SYSTEM_PROMPT;
    
    // Explicitly instruct the agent to use tools
    const instructions = `${systemInstruction}\n\nCRITICAL: You DO NOT have the graph data yet! You MUST use your provided tools (e.g., search_graph) to retrieve the relevant compliance nodes. VERY IMPORTANT: Once you find nodes, you MUST use 'find_neighbors' or 'graph_path' to explicitly fetch their connecting edges! If you do not query the edges, the Graph UI will not draw any lines between the nodes. Do NOT skip this step!`;
    
    const fullPrompt = `${historyText}USER: ${userMessage}`;
    
    console.log("[AI Copilot] Starting Native GenAI Multi-step Agent Loop with ADK Tools...");
    
    // Transform ADK FunctionTools to GenAI FunctionDeclarations safely
    // ADK 1.2.0 exposes _getDeclaration() to properly serialize Zod parameters into JSON Schema
    const functionDeclarations = regchainTools.map(t => typeof t._getDeclaration === 'function' ? t._getDeclaration() : {
      name: t.name,
      description: t.description,
      parameters: t.parameters
    });

    const chat = ai.chats.create({
      model: 'gemini-2.5-pro',
      config: {
        systemInstruction: instructions,
        tools: [{ functionDeclarations }],
        temperature: 0.2
      }
    });

    // Native multi-step orchestration (GenAI automatically executes function calls and loops)
    let agentResponse;
    const maxRetries = 3;
    let attempt = 0;
    
    let messagePayload = fileData ? [fileData, fullPrompt] : fullPrompt;

    while (attempt < maxRetries) {
      try {
        agentResponse = await chat.sendMessage({ message: messagePayload });
        
        // Handle explicit tool calls if GenAI doesn't auto-resolve them (SDK 0.1.x behavior)
        while (agentResponse.functionCalls && agentResponse.functionCalls.length > 0) {
          console.log(`[AI Copilot] Agent executing ${agentResponse.functionCalls.length} parallel ADK tools...`);
          const functionResponses = [];
          
          for (const call of agentResponse.functionCalls) {
            const tool = regchainTools.find(t => t.name === call.name);
            if (tool) {
              const result = await tool.execute(call.args);
              functionResponses.push({
                functionResponse: {
                  name: call.name,
                  response: result && typeof result === 'object' ? result : { result }
                }
              });
            }
          }
          
          agentResponse = await chat.sendMessage({ message: functionResponses });
        }
        
        textOutput = agentResponse.text;
        break;
      } catch (e) {
        attempt++;
        const errString = e.message || e.toString();
        if (errString.includes('429') || errString.includes('Resource exhausted') || e.status === 429) {
          console.warn(`[GenAI] Hit 429 rate limit. Backing off attempt ${attempt}...`);
          if (attempt >= maxRetries) throw new Error("Google GenAI rate limit exceeded.");
          await new Promise(res => setTimeout(res, 4000 * Math.pow(2, attempt)));
        } else {
          throw e; // Bubble up other errors immediately
        }
      }
    }
    
    console.log("[AI Copilot] Multi-step Agent Loop Complete.");

    // Sync the tracked tools session to our local sets
    global._activeToolSession.visitedNodes.forEach(n => visitedNodes.add(n));
    global._activeToolSession.visitedEdges.forEach(e => visitedEdges.add(e));
    
  } catch (error) {
    console.error("[AI Copilot] ADK Agent Orchestration Error:", error);
    textOutput = "Error: The AI Copilot encountered a problem during multi-step reasoning. " + error.message;
  }

  // 4. RESPONSE FORMATTING
  let cleanMessage = textOutput;

  // Extract JSON payload if present
  parsedData = null;
  const metadataMatch = cleanMessage.match(/```json\n([\s\S]*?)\n```/);
  if (metadataMatch) {
    try {
      parsedData = JSON.parse(metadataMatch[1]);
      cleanMessage = cleanMessage.replace(metadataMatch[0], '').trim();
    } catch (e) {
      console.warn("Failed to parse metadata JSON block:", e);
    }
  }

  // SECOND PASS VERIFICATION (as requested)
  // Ask Gemini to pick the important nodes/edges from the EXACT list of tracked items.
  let finalMetadata = { visited_nodes: [], visited_edges: [] };
  
  if (mode === 'analyze') {
    try {
      const trackedNodes = Array.from(visitedNodes);
      const trackedEdges = Array.from(visitedEdges);
      
      if (trackedNodes.length > 0 || trackedEdges.length > 0) {
        const verifierPrompt = `
You are a JSON extractor. 
Based on this final analysis:
"""
${cleanMessage}
"""

And based on the fact that the agent visited these specific items during its search:
Tracked Nodes: ${JSON.stringify(trackedNodes)}
Tracked Edges: ${JSON.stringify(trackedEdges)}

Return a strict JSON object identifying which of these EXACT nodes and edges were most important to the analysis. 
You MUST ONLY select items from the "Tracked Nodes" and "Tracked Edges" lists above. DO NOT invent new IDs.
Format: {"visited_nodes": ["id1"], "visited_edges": ["edge1"]}
Output ONLY the JSON block.`;

        const aiClient = getGenAI();
        const verifierResponse = await aiClient.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: verifierPrompt
        });
        
        let rawJsonText = verifierResponse.text;
        const vMatch = rawJsonText.match(/```(?:json)?\n([\s\S]*?)\n```/);
        if (vMatch) {
           rawJsonText = vMatch[1].trim();
        } else if (rawJsonText.startsWith('{')) {
           rawJsonText = rawJsonText.trim();
        } else {
           rawJsonText = "{}";
        }
        
        finalMetadata = JSON.parse(rawJsonText);
        
        // Safety sanitize
        finalMetadata.visited_nodes = (finalMetadata.visited_nodes || []).filter(n => trackedNodes.includes(n));
        finalMetadata.visited_edges = (finalMetadata.visited_edges || []).filter(e => trackedEdges.includes(e));
      }
    } catch (err) {
      console.error("[AI Copilot] Second pass verification failed:", err);
      // Fallback to everything tracked if verification fails
      finalMetadata.visited_nodes = Array.from(visitedNodes);
      finalMetadata.visited_edges = Array.from(visitedEdges);
    }
  }

  // Remove <thinking> blocks entirely
  cleanMessage = cleanMessage.replace(/<thinking>([\s\S]*?)<\/thinking>/g, '').trim();

  return {
    message: cleanMessage,
    suggestion: mode === 'build' && (parsedData?.proposed_nodes || parsedData?.proposed_edges || parsedData?.proposed_deletions || parsedData?.changes) ? parsedData : null,
    metadata: mode === 'analyze' ? finalMetadata : null,
    timestamp: new Date().toISOString()
  };
}
