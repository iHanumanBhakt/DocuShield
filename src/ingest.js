import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { Document } from "@langchain/core/documents";
import { PineconeStore } from "@langchain/pinecone";
import { embeddings, pinecone, PINECONE_INDEX_NAME } from "./config.js";

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const regulationsDir = "./data/regulations";

  console.log("🚀 Starting Ingestion Pipeline to Pinecone via LangChain...");

  try {
    // 1. Ensure Pinecone index exists
    const indexList = await pinecone.listIndexes();
    const exists = indexList.indexes.some(i => i.name === PINECONE_INDEX_NAME);

    if (!exists) {
      console.log(`ℹ️ Index "${PINECONE_INDEX_NAME}" does not exist. Creating a serverless index...`);
      await pinecone.createIndex({
        name: PINECONE_INDEX_NAME,
        dimension: 768, // Gemini text-embedding-004 outputs 768 dimensions
        metric: "cosine",
        spec: {
          serverless: {
            cloud: "aws",
            region: "us-east-1",
          },
        },
      });

      console.log("⏳ Waiting for Pinecone index to initialize...");
      let isReady = false;
      while (!isReady) {
        const status = await pinecone.describeIndex(PINECONE_INDEX_NAME);
        if (status.status.ready) {
          isReady = true;
        } else {
          await sleep(5000);
        }
      }
      console.log("✅ Pinecone index created and ready!");
    } else {
      console.log(`✅ Index "${PINECONE_INDEX_NAME}" already exists.`);
    }

    const pineconeIndex = pinecone.Index(PINECONE_INDEX_NAME);

    const files = await fs.readdir(regulationsDir);
    const textFiles = files.filter(f => f.endsWith(".txt") || f.endsWith(".md"));

    if (textFiles.length === 0) {
      console.log(`⚠️ No regulations files found in ${regulationsDir}`);
      return;
    }

    const documentsToUpsert = [];

    for (const file of textFiles) {
      const filePath = path.join(regulationsDir, file);
      console.log(`\n📖 Parsing regulation file: ${file}`);
      const content = await fs.readFile(filePath, "utf8");

      // Split file by markdown headers
      const rawSections = content.split(/(?=\n# )/);
      const sections = rawSections.map(s => s.trim()).filter(s => s.length > 0);

      console.log(`   Found ${sections.length} sections to process.`);

      for (const section of sections) {
        const lines = section.split("\n");
        const header = lines[0].replace("#", "").trim();
        const sectionContent = lines.slice(1).join("\n").trim();

        if (!sectionContent) continue;

        const parentId = crypto.randomUUID();

        // Chunk section content into sentences
        const sentences = sectionContent
          .split(/(?<=[.!?])\s+/)
          .map(s => s.trim())
          .filter(s => s.length > 10);

        // Group into child chunks (2 sentences each)
        const childChunks = [];
        for (let i = 0; i < sentences.length; i += 2) {
          const chunkText = sentences.slice(i, i + 2).join(" ");
          childChunks.push(chunkText);
        }

        console.log(`   └─ Section "${header}": Creating ${childChunks.length} documents...`);

        for (const chunkText of childChunks) {
          documentsToUpsert.push(
            new Document({
              pageContent: chunkText,
              metadata: {
                parentId,
                docName: file,
                sectionHeader: header,
                parentContent: sectionContent, // Holds parent context for RAG
              },
            })
          );
        }
      }
    }

    // 2. Ingest documents using LangChain PineconeStore (automatically embeddings & batching)
    if (documentsToUpsert.length > 0) {
      console.log(`\n📤 Ingesting ${documentsToUpsert.length} documents to Pinecone via LangChain...`);
      
      // LangChain handles embedding generation and batch uploads automatically under the hood
      await PineconeStore.fromDocuments(documentsToUpsert, embeddings, {
        pineconeIndex,
        textKey: "text",
      });

      console.log("✅ Ingestion successfully completed and synced to Pinecone via LangChain!");
    } else {
      console.log("⚠️ No documents to index.");
    }

  } catch (err) {
    console.error(`❌ Ingestion failed: ${err.message}`);
  }
}

main();
