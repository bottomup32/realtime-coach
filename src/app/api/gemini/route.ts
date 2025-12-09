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
