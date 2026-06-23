import { pinecone, PINECONE_INDEX_NAME } from "./config.js";

export class VectorDb {
  constructor() {
    this.index = pinecone.index(PINECONE_INDEX_NAME);
  }

  async load() {
    try {
      const indexList = await pinecone.listIndexes();
      const exists = indexList.indexes.some(i => i.name === PINECONE_INDEX_NAME);
      if (!exists) {
        console.error(`❌ Pinecone index "${PINECONE_INDEX_NAME}" does not exist in your account.`);
        return false;
      }
      return true;
    } catch (err) {
      console.error(`❌ Failed to connect to Pinecone: ${err.message}`);
      return false;
    }
  }

  async search(queryEmbedding, limit = 3) {
    try {
      const queryResponse = await this.index.query({
        vector: queryEmbedding,
        topK: limit * 2, // Query slightly more to allow deduplication of parents
        includeMetadata: true,
      });

      const retrievedParents = [];
      const seenParents = new Set();

      if (!queryResponse.matches) return [];

      for (const match of queryResponse.matches) {
        const metadata = match.metadata;
        if (!metadata) continue;

        const header = metadata.sectionHeader || "Unknown Section";
        if (!seenParents.has(header)) {
          seenParents.add(header);
          retrievedParents.push({
            parentDoc: {
              id: match.id,
              docName: metadata.docName,
              header: metadata.sectionHeader,
              content: metadata.parentContent,
            },
            score: match.score,
            matchedSnippet: metadata.text,
          });
        }

        if (retrievedParents.length >= limit) {
          break;
        }
      }

      return retrievedParents;
    } catch (err) {
      console.error(`❌ Error querying Pinecone: ${err.message}`);
      return [];
    }
  }
}
