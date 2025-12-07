
import { createClient, LiveClient, LiveConnectionState } from "@deepgram/sdk";

export const getDeepgramClient = () => {
    // We expect the key to be available via API route or passed in.
    // Client-side, we usually fetch a token from our API.
    return createClient(process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY || "");
};

// Hook or Helper for Live Connection
export const setupDeepgramConnection = (client: any) => {
    const connection = client.listen.live({
        model: "nova-2",
        language: "ko",
        smart_format: true,
        diarize: true,
    });
    return connection;
};
