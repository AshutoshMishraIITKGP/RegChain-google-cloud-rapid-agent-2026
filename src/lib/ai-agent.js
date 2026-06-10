import { GoogleGenAI } from '@google/genai';
import { getElasticClient } from './elastic.js';
import path from 'path';
import { ENTITY_INDEX, RELATIONSHIP_INDEX } from './constants.js';

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
1. Only include the SPECIFIC node and edge IDs that were critical to your analysis.
2. WARNING: NEVER hallucinate IDs from the Chat History! You MUST only use exact IDs that are explicitly present in the CURRENT "FULL KNOWLEDGE GRAPH" provided to you. If you mention an entity, use its exact 'id' field from the graph data.
3. CRITICAL: If you are identifying a "gap" or something missing, DO NOT invent fake IDs for the missing nodes/edges. Instead, your JSON must strictly contain the IDs of the EXISTING nodes and edges that formed the BASIS of your conclusion (i.e., the surrounding context).
4. The queries you would recieve would sometimes be analysis based, so include the subgraph/subgraphs which you used to get the analysis done (e.g. to identify a gap, you explored the regulation, the system and policies and found that the regulation isn't fully satisifed by those nodes, include the nodes you used to do the research and then show the user that how it isn't satisfied with the existing nodes and edges), don't change the context of the user query`;

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

  // --- STAGE 2: FULL GRAPH RETRIEVAL (GLM Architecture) ---
  const visitedNodes = new Set();
  const visitedEdges = new Set();
  let subgraphText = "--- FULL KNOWLEDGE GRAPH ---\nNodes:\n";

  try {
    const esClient = getElasticClient();
    
    // Fetch all entities (up to 500)
    const searchRes = await esClient.search({
      index: ENTITY_INDEX,
      size: 500,
      body: { query: { match_all: {} } }
    });

    let nodeHits = searchRes.hits?.hits || [];
    nodeHits.forEach(hit => {
      visitedNodes.add(hit._id || hit._source.id);
      subgraphText += JSON.stringify(hit._source) + "\n";
    });

    // Fetch all relationships (up to 1000)
    const relRes = await esClient.search({
      index: RELATIONSHIP_INDEX,
      size: 1000,
      body: { query: { match_all: {} } }
    });

    let edgeHits = relRes.hits?.hits || [];
    subgraphText += "\nRelationships:\n";
    edgeHits.forEach(hit => {
      if (hit._source && hit._source.source && hit._source.target) {
        // ONLY include edges if BOTH source and target nodes ACTUALLY exist in the graph!
        if (visitedNodes.has(hit._source.source) && visitedNodes.has(hit._source.target)) {
          visitedEdges.add(hit._id || hit._source.id);
          subgraphText += JSON.stringify(hit._source) + "\n";
        } else {
          console.warn(`[AI Copilot] Ignored dangling edge: ${hit._source.source} -> ${hit._source.target}`);
        }
      }
    });

    if (visitedNodes.size === 0) {
      subgraphText = "No relevant compliance graph data found.";
    }


  } catch (e) {
    console.error("Bounded Retrieval Error:", e);
    subgraphText = "Error retrieving graph context.";
  }

  // --- STAGE 3: DEEP REASONING (gemini-2.5-pro) ---
  let historyText = history.length > 0 
    ? "Chat History:\n" + history.map(m => `${m.sender?.toUpperCase() || m.role?.toUpperCase()}: ${m.text || m.content}`).join('\n') + "\n\n"
    : "";

  const systemInstruction = mode === 'build' ? BUILD_SYSTEM_PROMPT : ANALYZE_SYSTEM_PROMPT;
  const fullPrompt = `${systemInstruction}\n\n${subgraphText}\n\n${historyText}USER: ${userMessage}`;

  const contentsPayload = fileData ? [fileData, fullPrompt] : fullPrompt;

  const maxRetries = 5;
  let attempt = 0;
  let textOutput = '';

  while (attempt < maxRetries) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: contentsPayload,
      });
      textOutput = response.text;
      break; // Success!
    } catch (error) {
      attempt++;
      const errString = error.message || error.toString();
      if (errString.includes('429') || errString.includes('Resource exhausted') || error.status === 429) {
        console.warn(`[GenAI] Hit 429 rate limit. Backing off attempt ${attempt}...`);
        if (attempt >= maxRetries) throw new Error("Google GenAI error: " + errString);
        await new Promise(res => setTimeout(res, 3000 * Math.pow(2, attempt)));
      } else {
        throw new Error("Google GenAI error: " + errString);
      }
    }
  }

  // 4. RESPONSE FORMATTING
  let parsedData = null;
  let cleanMessage = textOutput;

  // Extract JSON payload if present
  const metadataMatch = cleanMessage.match(/```json\n([\s\S]*?)\n```/);
  if (metadataMatch) {
    try {
      parsedData = JSON.parse(metadataMatch[1]);
      cleanMessage = cleanMessage.replace(metadataMatch[0], '').trim();
    } catch (e) {
      console.warn("Failed to parse metadata JSON block:", e);
    }
  }

  if (!parsedData) parsedData = { visited_nodes: [], visited_edges: [] };
  if (!Array.isArray(parsedData.visited_nodes)) parsedData.visited_nodes = [];
  if (!Array.isArray(parsedData.visited_edges)) parsedData.visited_edges = [];

  // Deduplicate and filter out hallucinated IDs that aren't in the actual graph!
  parsedData.visited_nodes = [...new Set(parsedData.visited_nodes)]
    .filter(id => {
      const match = Array.from(visitedNodes).some(vid => String(vid).toLowerCase().trim() === String(id).toLowerCase().trim());
      if (!match) console.warn(`[AI Copilot] Stripped hallucinated node ID: ${id}`);
      return match;
    });

  parsedData.visited_edges = [...new Set(parsedData.visited_edges)]
    .filter(id => {
      const match = Array.from(visitedEdges).some(vid => String(vid).toLowerCase().trim() === String(id).toLowerCase().trim());
      if (!match) console.warn(`[AI Copilot] Stripped hallucinated edge ID: ${id}`);
      return match;
    });

  // Remove <thinking> blocks entirely
  cleanMessage = cleanMessage.replace(/<thinking>([\s\S]*?)<\/thinking>/g, '').trim();

  return {
    message: cleanMessage,
    suggestion: mode === 'build' && (parsedData?.proposed_nodes || parsedData?.proposed_edges || parsedData?.proposed_deletions || parsedData?.changes) ? parsedData : null,
    metadata: mode === 'analyze' ? parsedData : null,
    timestamp: new Date().toISOString()
  };
}
