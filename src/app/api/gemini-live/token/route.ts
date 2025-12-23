import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!apiKey) {
        return NextResponse.json(
            { error: "Google AI API key not configured. Set GOOGLE_GENERATIVE_AI_API_KEY in .env.local" },
            { status: 500 }
        );
    }

    // MVP: Return the API key directly for functional testing.
    // In production, use ephemeral tokens for better security.
    return NextResponse.json({
        key: apiKey,
    });
}

