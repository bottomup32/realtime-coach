
import { DeepgramError, createClient } from "@deepgram/sdk";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
    const deepgramApiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;

    if (!deepgramApiKey) {
        return NextResponse.json(
            { error: "Deepgram API key not configured" },
            { status: 500 }
        );
    }

    // MVP: Direct key return for functional testing.
    // We avoid creating temporary keys server-side because we lack a Project ID.
    return NextResponse.json({
        key: deepgramApiKey,
    });
}
