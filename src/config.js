import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { Pinecone } from "@pinecone-database/pinecone";
import "dotenv/config";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("⚠️ WARNING: GEMINI_API_KEY is not set in your environment variables.");
}

const pineconeKey = process.env.PINECONE_API_KEY;
if (!pineconeKey) {
  console.warn("⚠️ WARNING: PINECONE_API_KEY is not set in your environment variables.");
}

// LangChain Google GenAI embeddings wrapper
export const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "text-embedding-004",
  apiKey: apiKey || "dummy-key",
});

// LangChain Google GenAI chat model wrapper
export const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  apiKey: apiKey || "dummy-key",
});

// Pinecone Client
export const pinecone = new Pinecone({
  apiKey: pineconeKey || "dummy-key",
});

export const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX || "docushield";
