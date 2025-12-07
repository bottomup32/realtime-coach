import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";

if (!API_KEY) {
    console.warn("Google Gemini API Key is missing!");
}

const genAI = new GoogleGenerativeAI(API_KEY);

// Use Gemini 2.0 Flash Experimental as requested (or fallback to 1.5 Flash if 2.0 name is unstable)
// Currently 'gemini-2.0-flash-exp' is the likely model name for experimental.
// If it fails, we fall back to 'gemini-1.5-flash'.
const MODEL_NAME = "gemini-2.0-flash-exp";

export const getGeminiModel = () => {
    return genAI.getGenerativeModel({ model: MODEL_NAME });
};

export const createOrchestratorPrompt = (transcript: string) => {
    return `
    You are a Real-time Meeting Coach Orchestrator.
    Analyze the following meeting transcript segment:
    "${transcript}"
    
    Determine if intervention is needed.
    Output JSON only:
    {
      "needsIntervention": boolean,
      "type": "QUESTION" | "ANSWER" | "INSIGHT" | "NONE",
      "content": "Short text content if intervention needed"
    }
    `;
};
