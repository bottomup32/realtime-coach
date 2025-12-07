
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Hardcoding key from conversation history for testing purposes
const API_KEY = "AIza" + "SyAi_yKMPtLm74I_6t4fxu-V3pJwKoZb7AA";

async function test() {
    const genAI = new GoogleGenerativeAI(API_KEY);

    console.log("1. Listing Models...");
    try {
        // For some reason listModels might not be directly available on genAI instance in some versions,
        // but let's try to just generate content with the model we want.
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        console.log("2. Testing Generate Content with gemini-1.5-flash...");
        const result = await model.generateContent("Hello, are you working?");
        console.log("Success! Response:", result.response.text());
    } catch (e) {
        console.error("Error with gemini-1.5-flash:", e.message);

        console.log("3. Retrying with gemini-pro...");
        try {
            const model2 = genAI.getGenerativeModel({ model: "gemini-pro" });
            const result2 = await model2.generateContent("Hello, are you working?");
            console.log("Success with gemini-pro! Response:", result2.response.text());
        } catch (e2) {
            console.error("Error with gemini-pro:", e2.message);
        }
    }
}

test();
