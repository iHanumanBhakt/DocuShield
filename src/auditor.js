import fs from "fs/promises";
import path from "path";
import { ai, MODELS } from "./config.js";
import { VectorDb } from "./vectorDb.js";

export async function auditContract(contractFilePath) {
  const dbPath = "./data/vector_db.json";
  const db = new VectorDb();

  // 1. Load Vector Database
  const loaded = await db.load(dbPath);
  if (!loaded) {
    throw new Error("Vector database file not found. Please run 'npm run ingest' first to index regulations.");
  }

  console.log(`\n🔍 Auditing contract: ${path.basename(contractFilePath)}`);
  const contractContent = await fs.readFile(contractFilePath, "utf8");

  // 2. Extract clauses from contract (splits by "Clause X:")
  const rawClauses = contractContent.split(/(?=\bClause \d+:)/);
  const clauses = rawClauses.map(c => c.trim()).filter(c => c.length > 0 && c.includes("Clause"));

  console.log(`   Extracted ${clauses.length} clauses for analysis.`);
  const auditReport = [];

  for (const clause of clauses) {
    // Extract clause title/id (e.g., "Clause 1: Purpose & Data Minimization")
    const title = clause.split("\n")[0].trim();
    console.log(`   ⏳ Auditing ${title}...`);

    try {
      // 3. Embed the contract clause to perform semantic search
      const embedResponse = await ai.models.embedContent({
        model: MODELS.embedding,
        contents: clause,
      });
      const queryEmbedding = embedResponse.embedding.values;

      // 4. Query Vector Database (Parent-Document Retrieval)
      const retrieved = await db.search(queryEmbedding, 2);

      if (retrieved.length === 0) {
        console.log(`      ⚠️ No matching regulations found for ${title}. Skipping.`);
        continue;
      }

      // Format context for RAG
      const contextText = retrieved.map((match, idx) => {
        const doc = match.parentDoc;
        return `[REGULATION REFERENCE ${idx + 1}]
Source File: ${doc.docName}
Section: ${doc.header}
Content:
${doc.content}`;
      }).join("\n\n");

      // 5. Construct RAG Audit Prompt
      const auditPrompt = `
You are an expert Regulatory Compliance Auditor.
You will evaluate a contract clause against the provided regulatory references and output a compliance report.

---
CONTRACT CLAUSE TO AUDIT:
"""
${clause}
"""

---
REGULATORY REFERENCES (RETRIEVED FROM DATABASE):
${contextText}

---
AUDIT INSTRUCTIONS:
1. **Analyze Compatibility:** Determine if the contract clause complies with or violates the provided regulatory references.
2. **Assign Verdict:** Choose exactly one status:
   - **COMPLIANT:** No violations found.
   - **NON-COMPLIANT:** Contains clear violations of the regulations.
   - **INSUFFICIENT_INFORMATION:** The regulations are not applicable to this clause.
3. **Draft Justification:** Explain exactly which sections of the regulation are violated or complied with, referencing specific Article titles/sections.
4. **Suggest a Rewrite:** If the status is NON-COMPLIANT, provide a professionally drafted, compliant rewrite of the clause that fulfills the same business goal but adheres to the regulations.

Format your output in clean Markdown with the following headers:
### Verdict: [COMPLIANT / NON-COMPLIANT / INSUFFICIENT_INFORMATION]
**Analysis:** [Detailed legal analysis]
**Violations:** [List specific articles violated, if any]
**Suggested Rewrite:** [Rewritten clause]
`;

      // 6. Generate Audit Report via Gemini
      const response = await ai.models.generateContent({
        model: MODELS.generation,
        contents: auditPrompt,
      });

      auditReport.push({
        clauseTitle: title,
        originalClause: clause,
        retrievedContexts: retrieved.map(r => ({
          header: r.parentDoc.header,
          score: r.score.toFixed(3),
        })),
        auditOutput: response.text.trim(),
      });

    } catch (err) {
      console.error(`      ❌ Error auditing clause: ${err.message}`);
      auditReport.push({
        clauseTitle: title,
        originalClause: clause,
        error: err.message,
      });
    }
  }

  return auditReport;
}
