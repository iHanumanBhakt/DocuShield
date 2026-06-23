import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { ai, MODELS, pinecone, PINECONE_INDEX_NAME } from "./config.js";

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const regulationsDir = "./data/regulations";

  console.log("🚀 Starting Ingestion Pipeline to Pinecone...");

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
            region: "us-east-1", // standard free tier region
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

    const index = pinecone.index(PINECONE_INDEX_NAME);

    const files = await fs.readdir(regulationsDir);
    const textFiles = files.filter(f => f.endsWith(".txt") || f.endsWith(".md"));

    if (textFiles.length === 0) {
      console.log(`⚠️ No regulations files found in ${regulationsDir}`);
      return;
    }

    const vectorsToUpsert = [];

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

        console.log(`   └─ Section "${header}": Generating embeddings for ${childChunks.length} chunks...`);

        for (const chunkText of childChunks) {
          try {
            // Get vector embedding from Gemini
            const response = await ai.models.embedContent({
              model: MODELS.embedding,
              contents: chunkText,
            });
            const embedding = response.embedding.values;

            const childId = crypto.randomUUID();

            vectorsToUpsert.push({
              id: childId,
              values: embedding,
              metadata: {
                parentId,
                text: chunkText,
                docName: file,
                sectionHeader: header,
                parentContent: sectionContent, // Holds parent context for RAG
              },
            });
          } catch (embedError) {
            console.error(`      ❌ Failed to embed chunk: "${chunkText.substring(0, 30)}..." - Error: ${embedError.message}`);
          }
        }
      }
    }

    // 2. Upsert in batches of 50 to avoid payload size limit issues
    if (vectorsToUpsert.length > 0) {
      const batchSize = 50;
      console.log(`\n📤 Upserting ${vectorsToUpsert.length} vectors to Pinecone in batches of ${batchSize}...`);

      for (let i = 0; i < vectorsToUpsert.length; i += batchSize) {
        const batch = vectorsToUpsert.slice(i, i + batchSize);
        await index.upsert(batch);
        console.log(`   Uploaded batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(vectorsToUpsert.length / batchSize)}`);
      }

      console.log("✅ Ingestion successfully completed and synced to Pinecone!");
    } else {
      console.log("⚠️ No vectors to index.");
    }

  } catch (err) {
    console.error(`❌ Ingestion failed: ${err.message}`);
  }
}

main();
