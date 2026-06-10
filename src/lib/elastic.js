import { Client } from '@elastic/elasticsearch';
import { INDICES } from './constants';

let elasticClient = null;

export function getElasticClient() {
  if (!elasticClient) {
    const url = process.env.ELASTIC_URL;
    const apiKey = process.env.ELASTIC_API_KEY;

    if (!url || !apiKey) {
      throw new Error('ELASTIC_URL and ELASTIC_API_KEY must be set in environment variables');
    }

    elasticClient = new Client({
      node: url,
      auth: { apiKey },
      tls: { rejectUnauthorized: false },
      requestTimeout: 60000,
      maxRetries: 5
    });
  }
  return elasticClient;
}

export async function ensureIndices() {
  const client = getElasticClient();
  // Ensure indices for chat history and graph exist
  const indices = Object.values(INDICES);
  for (const index of indices) {
    const exists = await client.indices.exists({ index });
    if (!exists) {
      try {
        await client.indices.create({ index });
      } catch (err) {
        if (err.meta?.statusCode !== 400) {
          console.error(`Failed to create index ${index}`, err);
        }
      }
    }
  }
}

export async function searchDocuments(index, query = {}, size = 100) {
  const client = getElasticClient();
  const response = await client.search({
    index,
    size,
    body: Object.keys(query).length > 0 ? { query } : { query: { match_all: {} } }
  });
  return response.hits.hits.map(h => ({ id: h._id, ...h._source }));
}

export async function getDocument(index, id) {
  const client = getElasticClient();
  const response = await client.get({ index, id });
  return { id: response._id, ...response._source };
}

export async function indexDocument(index, id, document) {
  const client = getElasticClient();
  await client.index({
    index,
    id,
    body: document,
    refresh: true
  });
  return document;
}

export async function updateDocument(index, id, doc) {
  const client = getElasticClient();
  await client.update({
    index,
    id,
    body: { doc },
    refresh: true
  });
  return doc;
}

export async function deleteDocument(index, id) {
  const client = getElasticClient();
  await client.delete({ index, id, refresh: true });
  return true;
}
