import { GoogleGenAI } from "@google/genai";
import { Pinecone } from "@pinecone-database/pinecone";
import "dotenv/config";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("⚠️ WARNING: GEMINI_API_KEY is not set in your environment variables.");
}

export const ai = new GoogleGenAI({ apiKey });

const pineconeKey = process.env.PINECONE_API_KEY;
if (!pineconeKey) {
  console.warn("⚠️ WARNING: PINECONE_API_KEY is not set in your environment variables.");
}

export const pinecone = new Pinecone({ apiKey: pineconeKey });

export const MODELS = {
  embedding: "text-embedding-004",
  generation: "gemini-2.5-flash",
};

export const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX || "docushield";
