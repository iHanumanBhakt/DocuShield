import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("⚠️ WARNING: GEMINI_API_KEY is not set in your environment variables.");
}

export const ai = new GoogleGenAI({ apiKey });

export const MODELS = {
  embedding: "text-embedding-004",
  generation: "gemini-2.5-flash",
};
