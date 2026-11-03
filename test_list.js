import { GoogleGenAI } from "@google/genai";
const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!apiKey) throw new Error("Set GOOGLE_GENERATIVE_AI_API_KEY");
const ai = new GoogleGenAI({ apiKey });
for await (const model of await ai.models.list()) console.log(model.name);
