import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { ai, MODELS } from "./config.js";
import { VectorDb } from "./vectorDb.js";

async function main() {
  const db = new VectorDb();
  const regulationsDir = "./data/regulations";
  const dbPath = "./data/vector_db.json";

  console.log("🚀 Starting Ingestion Pipeline...");

  try {
    const files = await fs.readdir(regulationsDir);
    const textFiles = files.filter(f => f.endsWith(".txt") || f.endsWith(".md"));

    if (textFiles.length === 0) {
      console.log(`⚠️ No regulations files found in ${regulationsDir}`);
      return;
    }

    for (const file of textFiles) {
      const filePath = path.join(regulationsDir, file);
      console.log(`📖 Parsing regulation file: ${file}`);
      const content = await fs.readFile(filePath, "utf8");

      // Split file by markdown headers (e.g., "# Article")
      const rawSections = content.split(/(?=\n# )/);
      const sections = rawSections.map(s => s.trim()).filter(s => s.length > 0);

      console.log(`   Found ${sections.length} sections to index.`);

      for (const section of sections) {
        // Extract header (first line)
        const lines = section.split("\n");
        const header = lines[0].replace("#", "").trim();
        const sectionContent = lines.slice(1).join("\n").trim();

        if (!sectionContent) continue;

        const parentId = crypto.randomUUID();
        db.addParentDocument(parentId, file, header, sectionContent);

        // Split section content into sentences
        const sentences = sectionContent
          .split(/(?<=[.!?])\s+/)
          .map(s => s.trim())
          .filter(s => s.length > 10); // ignore very short fragments

        // Group into child chunks (2 sentences each) for semantic search
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
            db.addChildChunk(childId, parentId, chunkText, embedding, {
              docName: file,
              sectionHeader: header,
            });
          } catch (embedError) {
            console.error(`      ❌ Failed to embed chunk: "${chunkText.substring(0, 30)}..." - Error: ${embedError.message}`);
          }
        }
      }
    }

    // Save index
    await db.save(dbPath);
    console.log("✅ Ingestion successfully completed!");
  } catch (err) {
    console.error(`❌ Ingestion failed: ${err.message}`);
  }
}

main();
