# DocuShield: Smart Regulatory & Compliance Auditor (RAG)

DocuShield is an advanced, self-contained compliance auditing application built with Node.js. It leverages Retrieval-Augmented Generation (RAG) to compare corporate agreements or policies against complex regulatory standards (e.g., GDPR, HIPAA) and automatically flags violations with exact citations and suggested compliant rewrites.

---

## Key Features

1. **Custom Vector Database:** Written from scratch in JavaScript. It implements pure mathematical **Cosine Similarity** for semantic search, eliminating the need for complex external database setups (like Docker, PostgreSQL/pgvector, or cloud vector stores).
2. **Parent-Document Retrieval:** Matches small 2-sentence child chunks during vector search for maximum semantic precision, but retrieves and sends the full parent policy/article to the LLM. This provides the generator with the complete legal context, reducing hallucinations and legal misinterpretations.
3. **Automated Compliance Auditing:** Parses contracts into clauses, audits them against the regulatory database using Gemini, and outputs:
   - A **Verdict** (`COMPLIANT` / `NON-COMPLIANT` / `INSUFFICIENT_INFORMATION`)
   - A **Detailed Legal Analysis**
   - Explicit **Violations** (citing specific articles)
   - A **Suggested Clause Rewrite**
4. **Data Persistence:** Serializes the vector database into a local JSON index (`data/vector_db.json`) for instant startup.

---

## System Architecture

```mermaid
graph TD
    %% Ingestion Pipeline
    subgraph Ingestion [Ingestion Pipeline]
        A[Regulatory Text] --> B[Section Parser]
        B --> C[Child Chunking: 2-Sentence Windows]
        C -->|Embeddings API| D[(Custom Vector DB: JSON)]
    end

    %% Auditing Pipeline
    subgraph Auditing [Auditing Pipeline]
        E[Corporate Contract] --> F[Clause Extractor]
        F -->|Extract clauses| G[Audit Queries]
        G -->|Vector Query| D
        D -->|Retrieve Child Match| H[Parent Document Linker]
        H -->|Resolve to Full Article| I[Retrieved Regulations Context]
    end

    %% RAG Verification
    subgraph RAG [RAG Auditor]
        I --> J[Gemini 2.5 Flash]
        J --> K[Structured Audit Report]
    end
```

---

## Directory Structure

```text
e:/DocuShield/
├── .env.example              # Environment configuration template
├── .gitignore                # Git exclusions (ignores secrets and generated DBs)
├── package.json              # App scripts and dependencies
├── index.js                  # Main CLI readline entry point
├── README.md                 # Detailed documentation
├── data/
│   ├── regulations/          # Regulatory texts database
│   │   └── gdpr_sample.txt   # Sample GDPR policy articles (Arts 5, 6, 17)
│   ├── contracts/            # Target contracts to audit
│   │   └── vendor_agreement_sample.txt # Sample agreement with violations
│   └── vector_db.json        # Persisted vector database (generated)
└── src/
    ├── config.js             # Initializing Gemini client & constants
    ├── vectorDb.js           # Custom Vector DB & Cosine Similarity logic
    ├── ingest.js             # Ingests regulations, chunks, and embeds them
    └── auditor.js            # Conducts clause-level Parent-Doc RAG audits
```

---

## Setup & Installation

### 1. Clone the repository
```bash
git clone https://github.com/iHanumanBhakt/DocuShield.git
cd DocuShield
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
Create a `.env` file in the root of the project:
```bash
cp .env.example .env
```
Open `.env` and fill in your Gemini API key (obtainable from [Google AI Studio](https://aistudio.google.com/)):
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

---

## Usage Guide

### Step 1: Ingest Regulations
Build the semantic vector database by indexing the regulatory texts:
```bash
npm run ingest
```
This reads the text files in `data/regulations`, segments them, requests embeddings using Gemini's `text-embedding-004` model, and saves the vector space to `data/vector_db.json`.

### Step 2: Audit a Contract
Launch the compliance auditor:
```bash
npm start
```
1. Select the target contract (e.g., `vendor_agreement_sample.txt`) from the menu.
2. The auditor will extract each clause, query the vector database, construct the RAG prompt, and present the compliance results in the terminal.
3. A copy of the full Markdown audit report will be saved to `data/audit_report.md`.

---

## Math Behind the Custom Vector Search

To calculate similarity between embeddings without an external DB, the engine implements the **Cosine Similarity** formula in pure JavaScript:

$$\text{similarity} = \cos(\theta) = \frac{\mathbf{A} \cdot \mathbf{B}}{\|\mathbf{A}\| \|\mathbf{B}\|} = \frac{\sum_{i=1}^{n} A_i B_i}{\sqrt{\sum_{i=1}^{n} A_i^2} \sqrt{\sum_{i=1}^{n} B_i^2}}$$

This calculates the cosine of the angle between the query vector $\mathbf{A}$ and the indexed document vector $\mathbf{B}$. A score closer to `1.0` indicates high semantic similarity.
