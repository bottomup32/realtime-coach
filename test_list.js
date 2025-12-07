
const { GoogleGenerativeAI } = require("@google/generative-ai");

const API_KEY = "AIza" + "SyAi_yKMPtLm74I_6t4fxu-V3pJwKoZb7AA";

async function list() {
    const genAI = new GoogleGenerativeAI(API_KEY);
    // Access the model manager to list models
    // Note: SDK structure might vary, but usually it's direct or via a manager.
    // We'll try a raw fetch if SDK fails, but let's try a direct request first to the list endpoint manually if needed.
    // But standard SDK usage:

    try {
        // Manual fetch implementation to be sure, as SDK versions vary
        console.log("Fetching models via REST API...");
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
        const data = await response.json();

        if (data.models) {
            console.log("Available Models:");
            data.models.forEach(m => console.log(`- ${m.name} (${m.supportedGenerationMethods.join(', ')})`));
        } else {
            console.log("No models found or error:", data);
        }
    } catch (e) {
        console.error("List failed:", e);
    }
}

list();
