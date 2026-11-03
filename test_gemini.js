import { GoogleGenAI } from "@google/genai";
const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const model = process.env.GEMINI_COACH_MODEL;
if (!apiKey || !model) throw new Error("Set GOOGLE_GENERATIVE_AI_API_KEY and GEMINI_COACH_MODEL");
const ai = new GoogleGenAI({ apiKey });
const response = await ai.models.generateContent({ model, contents: "한국어로 짧게 인사해 주세요." });
console.log(response.text);
