
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);
const MODEL_NAME = "gemini-2.0-flash";

export async function POST(req: Request) {
    try {
        if (!API_KEY) {
            return NextResponse.json({ error: "Gemini Key Missing" }, { status: 500 });
        }

        const { text, prompts, activeAgents } = await req.json();

        if (!text || text.trim().length < 5) {
            return NextResponse.json({ needsIntervention: false });
        }

        const model = genAI.getGenerativeModel({ model: MODEL_NAME });

        // Build Composite Prompt
        let systemContext = `
        You are an advanced Real-time Communication Coach Orchestrator.
        
        [GLOBAL CONTEXT]
        Analyze the following meeting transcript segment.
        Determine if the user requires immediate assistance based on the active agents.
        
        [AGENTS & INSTRUCTIONS]
        `;

        if (prompts?.orchestrator) {
            systemContext += `\n\n--- ORCHESTRATOR RULES ---\n${prompts.orchestrator}`;
        }

        if (activeAgents?.question && prompts?.question) {
            systemContext += `\n\n--- QUESTION AGENT ---\n${prompts.question}`;
        }

        if (activeAgents?.answer && prompts?.answer) {
            systemContext += `\n\n--- ANSWER AGENT ---\n${prompts.answer}`;
        }

        if (activeAgents?.insight && prompts?.insight) {
            systemContext += `\n\n--- INSIGHT AGENT ---\n${prompts.insight}`;
        }

        systemContext += `
        
        [OUTPUT FORMAT]
        Return purely JSON:
        {
            "needsIntervention": boolean,
            "type": "QUESTION" | "ANSWER" | "INSIGHT" | "NONE",
            "content": "The actual content/feedback string (max 20 words). Korean preferred."
        }
        `;

        const finalPrompt = `
        ${systemContext}

        [TRANSCRIPT SEGMENT]
        "${text}"
        `;

        const result = await model.generateContent(finalPrompt);
        const response = result.response;
        const responseText = response.text();
        const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

        try {
            const parsed = JSON.parse(jsonStr);
            return NextResponse.json(parsed);
        } catch (parseError) {
            console.error("JSON Parse Error:", jsonStr);
            return NextResponse.json({ needsIntervention: false, error: "AI Format Error" });
        }

    } catch (error: any) {
        console.error("Gemini API Error:", error.message);
        return NextResponse.json({ error: error.message || "Processing Failed" }, { status: 500 });
    }
}
