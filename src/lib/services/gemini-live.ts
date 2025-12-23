/**
 * Gemini Live API Service
 * Handles WebSocket connection to Gemini for real-time audio transcription
 */

import { GoogleGenAI, Modality } from '@google/genai';

export interface GeminiLiveConfig {
    apiKey?: string;
    ephemeralToken?: string;
    systemInstruction?: string;
    onTranscript?: (text: string, speaker?: string) => void;
    onInsight?: (type: string, content: string) => void;
    onError?: (error: Error) => void;
    onOpen?: () => void;
    onClose?: () => void;
}

export interface GeminiLiveSession {
    send: (audioData: ArrayBuffer) => void;
    close: () => void;
    isConnected: () => boolean;
}

// Minimal system instruction - we rely on inputAudioTranscription for transcription
// This reduces model thinking/output and saves costs
const DEFAULT_SYSTEM_INSTRUCTION = `You are a silent listener. Do not respond or speak unless directly asked a question. Your role is to simply listen to the audio input.`;

export async function createGeminiLiveSession(config: GeminiLiveConfig): Promise<GeminiLiveSession> {
    const ai = new GoogleGenAI({
        apiKey: config.apiKey || config.ephemeralToken,
    });

    const responseQueue: any[] = [];
    let session: any = null;
    let isConnected = false;

    // Transcript buffering for sentence-level output
    let transcriptBuffer = '';
    let lastTranscriptTime = Date.now();
    let flushTimeout: ReturnType<typeof setTimeout> | null = null;

    const SENTENCE_ENDINGS = /[.!?。？！]/;
    const FLUSH_DELAY_MS = 1500; // Flush buffer after 1.5s of silence

    const flushTranscriptBuffer = () => {
        if (transcriptBuffer.trim()) {
            console.log('Transcript (sentence):', transcriptBuffer.trim());
            config.onTranscript?.(transcriptBuffer.trim());
            transcriptBuffer = '';
        }
    };

    const model = 'gemini-2.5-flash-native-audio-preview-12-2025';
    const liveConfig = {
        responseModalities: [Modality.AUDIO], // Must be AUDIO to receive audio input
        inputAudioTranscription: {}, // Enable input audio transcription
        systemInstruction: config.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION,
    };

    // Message processing loop
    const processMessages = () => {
        while (responseQueue.length > 0) {
            const message = responseQueue.shift();

            try {
                // Handle input transcription (the audio we sent)
                if (message.serverContent?.inputTranscription?.text) {
                    const text = message.serverContent.inputTranscription.text;

                    // Add to buffer
                    transcriptBuffer += text;
                    lastTranscriptTime = Date.now();

                    // Clear existing flush timeout
                    if (flushTimeout) {
                        clearTimeout(flushTimeout);
                    }

                    // Check if we have a sentence ending
                    if (SENTENCE_ENDINGS.test(text)) {
                        flushTranscriptBuffer();
                    } else {
                        // Set timeout to flush if no more text comes
                        flushTimeout = setTimeout(flushTranscriptBuffer, FLUSH_DELAY_MS);
                    }
                }

                // Note: We're not processing modelTurn responses to minimize costs
                // The model is instructed to be silent, but if you need AI insights, 
                // they should come from the separate /api/gemini endpoint after transcription
            } catch (e) {
                console.error("Message processing error:", e);
            }
        }

        // Continue processing
        if (isConnected) {
            setTimeout(processMessages, 50);
        }
    };

    // Connect to Gemini Live
    try {
        session = await ai.live.connect({
            model: model,
            config: liveConfig,
            callbacks: {
                onopen: () => {
                    isConnected = true;
                    console.log('Gemini Live connected');
                    config.onOpen?.();
                    processMessages();
                },
                onmessage: (message: any) => {
                    responseQueue.push(message);
                },
                onerror: (e: any) => {
                    console.error('Gemini Live error:', e.message);
                    config.onError?.(new Error(e.message));
                },
                onclose: (e: any) => {
                    isConnected = false;
                    console.log('Gemini Live closed:', e?.reason);
                    config.onClose?.();
                },
            },
        });
    } catch (error: any) {
        config.onError?.(error);
        throw error;
    }

    return {
        send: (audioData: ArrayBuffer) => {
            if (!isConnected || !session) return;

            // Convert ArrayBuffer to base64
            const base64Audio = arrayBufferToBase64(audioData);

            session.sendRealtimeInput({
                audio: {
                    data: base64Audio,
                    mimeType: "audio/pcm;rate=16000"
                }
            });
        },
        close: () => {
            // Flush any remaining transcript
            if (flushTimeout) {
                clearTimeout(flushTimeout);
            }
            flushTranscriptBuffer();

            isConnected = false;
            session?.close();
        },
        isConnected: () => isConnected,
    };
}

// Helper function to convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}
