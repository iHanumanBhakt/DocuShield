import fs from "fs/promises";
import path from "path";

export function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    throw new Error("Vectors must be of the same length.");
  }
  let dotProduct = 0.0;
  let normA = 0.0;
  let normB = 0.0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export class VectorDb {
  constructor() {
    this.parentDocuments = {}; // Map of parentId -> { id, docName, header, content }
    this.childChunks = [];      // Array of { id, parentId, text, embedding, metadata }
  }

  addParentDocument(id, docName, header, content) {
    this.parentDocuments[id] = { id, docName, header, content };
  }

  addChildChunk(id, parentId, text, embedding, metadata = {}) {
    this.childChunks.push({ id, parentId, text, embedding, metadata });
  }

  async save(dbFilePath) {
    try {
      await fs.mkdir(path.dirname(dbFilePath), { recursive: true });
      const data = {
        parentDocuments: this.parentDocuments,
        childChunks: this.childChunks,
      };
      await fs.writeFile(dbFilePath, JSON.stringify(data, null, 2), "utf8");
      console.log(`💾 Saved Vector Database to ${dbFilePath} (${this.childChunks.length} chunks indexed)`);
    } catch (err) {
      console.error(`❌ Error saving Vector Database: ${err.message}`);
    }
  }

  async load(dbFilePath) {
    try {
      const dataText = await fs.readFile(dbFilePath, "utf8");
      const data = JSON.parse(dataText);
      this.parentDocuments = data.parentDocuments || {};
      this.childChunks = data.childChunks || [];
      console.log(`📂 Loaded Vector Database from ${dbFilePath} (${this.childChunks.length} chunks loaded)`);
      return true;
    } catch (err) {
      // If file doesn't exist, we start with an empty DB, which is normal before first ingestion
      return false;
    }
  }

  search(queryEmbedding, limit = 3) {
    if (this.childChunks.length === 0) {
      return [];
    }

    // 1. Calculate similarity for all child chunks
    const matches = this.childChunks.map((chunk) => {
      const score = cosineSimilarity(queryEmbedding, chunk.embedding);
      return { chunk, score };
    });

    // 2. Sort by similarity score descending
    matches.sort((a, b) => b.score - a.score);

    // 3. Retrieve unique parent documents from top child matches
    const retrievedParents = [];
    const seenParents = new Set();

    for (const match of matches) {
      const parentId = match.chunk.parentId;
      if (!seenParents.has(parentId)) {
        seenParents.add(parentId);
        const parentDoc = this.parentDocuments[parentId];
        if (parentDoc) {
          retrievedParents.push({
            parentDoc,
            score: match.score, // keep the best similarity score of its child
            matchedSnippet: match.chunk.text,
          });
        }
      }
      if (retrievedParents.length >= limit) {
        break;
      }
    }

    return retrievedParents;
  }
}
