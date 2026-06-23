import { PineconeStore } from "@langchain/pinecone";
import { pinecone, PINECONE_INDEX_NAME, embeddings } from "./config.js";

export class VectorDb {
  constructor() {
    this.pineconeIndex = pinecone.Index(PINECONE_INDEX_NAME);
    this.store = null;
  }

  async load() {
    try {
      const indexList = await pinecone.listIndexes();
      const exists = indexList.indexes.some(i => i.name === PINECONE_INDEX_NAME);
      if (!exists) {
        console.error(`❌ Pinecone index "${PINECONE_INDEX_NAME}" does not exist in your account.`);
        return false;
      }

      this.store = await PineconeStore.fromExistingIndex(embeddings, {
        pineconeIndex: this.pineconeIndex,
        textKey: "text",
      });

      return true;
    } catch (err) {
      console.error(`❌ Failed to connect to Pinecone: ${err.message}`);
      return false;
    }
  }

  async search(queryEmbedding, limit = 3) {
    try {
      if (!this.store) {
        const initialized = await this.load();
        if (!initialized) return [];
      }

      // Perform semantic search using the precomputed query embedding
      const matches = await this.store.similaritySearchVectorWithScore(queryEmbedding, limit * 2);

      const retrievedParents = [];
      const seenParents = new Set();

      for (const [doc, score] of matches) {
        const metadata = doc.metadata;
        if (!metadata) continue;

        const header = metadata.sectionHeader || "Unknown Section";
        if (!seenParents.has(header)) {
          seenParents.add(header);
          retrievedParents.push({
            parentDoc: {
              id: doc.id,
              docName: metadata.docName,
              header: metadata.sectionHeader,
              content: metadata.parentContent,
            },
            score: score,
            matchedSnippet: doc.pageContent,
          });
        }

        if (retrievedParents.length >= limit) {
          break;
        }
      }

      return retrievedParents;
    } catch (err) {
      console.error(`❌ Error querying Pinecone via LangChain: ${err.message}`);
      return [];
    }
  }
}
