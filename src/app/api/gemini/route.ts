return NextResponse.json({ needsIntervention: false, error: "AI Format Error" });
}

    } catch (error: any) {
    console.error("Gemini API Error:", error.message);
    return NextResponse.json({ error: error.message || "Processing Failed" }, { status: 500 });
}
}
