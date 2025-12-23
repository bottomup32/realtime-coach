
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

// Initialize Gemini with the API key from environment variables
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);

// Use the experimental flash model for speed and cost effectiveness
const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-exp",
    generationConfig: { responseMimeType: "application/json" }
});

export async function POST(req: Request) {
    try {
        const { text, prompts, activeAgents, previousContext } = await req.json();

        // 1. Construct System Context with Rolling Memory
        let systemContext = `
        You are an advanced Real-time Communication Coach Orchestrator (Chief of Staff).
        
        [MEMORY / PREVIOUS CONTEXT]
        "${previousContext || "Meeting just started."}"

        [CRITICAL RULES]
        - BE SELECTIVE: Only intervene when there is GENUINE VALUE to add. 
        - Quality over quantity: A great coach speaks rarely but meaningfully.
        - DO NOT intervene just because you received new text.
        - Set needsIntervention=false UNLESS one of these conditions is met:
          * User asks a direct question that needs answering
          * There's a significant insight or pattern worth highlighting
          * User seems confused or stuck and needs guidance
          * Important action item or key decision is mentioned

        [TASK]
        1. Analyze the new transcript chunk below.
        2. UPDATE the executive summary of the meeting context (max 2 sentences).
        3. ONLY intervene if genuinely valuable - most of the time, needsIntervention should be FALSE.
        
        [AGENTS & INSTRUCTIONS]
        `;

        if (activeAgents.question) {
            systemContext += `\n- QUESTION AGENT: "${prompts.question}" (Trigger: High ambiguity, missed detail, or user seems stuck)`;
        }
        if (activeAgents.answer) {
            systemContext += `\n- ANSWER AGENT: "${prompts.answer}" (Trigger: ONLY when direct question asked that you can answer)`;
        }
        if (activeAgents.insight) {
            systemContext += `\n- INSIGHT AGENT: "${prompts.insight}" (Trigger: Key takeaway, action item, or truly interesting pattern)`;
        }

        systemContext += `
        
        [OUTPUT FORMAT]
        Return purely JSON:
        {
            "updatedContext": "The new running summary of the conversation...",
            "needsIntervention": boolean (DEFAULT TO FALSE unless genuinely valuable),
            "type": "QUESTION" | "ANSWER" | "INSIGHT" | "NONE",
            "content": "The actual feedback string if intervention is needed."
        }
        `;

        const finalPrompt = `
        ${systemContext}

        [NEW TRANSCRIPT CHUNK]
        "${text}"
        `;

        // 2. Generate Content
        const result = await model.generateContent(finalPrompt);
        const response = result.response;
        const responseText = response.text();

        // 3. Robust JSON Parsing
        // Remove markdown code blocks if present (though responseMimeType should handle it)
        const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

        try {
            const parsed = JSON.parse(jsonStr);

            // Return BOTH the feedback and the updated context
            return NextResponse.json({
                ...parsed,
                updatedContext: parsed.updatedContext // Ensure this is passed back
            });

        } catch (parseError) {
            console.error("JSON Parse Error:", parseError, "Raw:", responseText);
            return NextResponse.json({ needsIntervention: false, error: "AI Format Error" });
        }

    } catch (error: any) {
        console.error("Gemini API Error:", error.message);
        return NextResponse.json({ error: error.message || "Processing Failed" }, { status: 500 });
    }
}
