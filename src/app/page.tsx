
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { AudioCapture } from '@/lib/audio/capture';
import { getDeepgramClient, setupDeepgramConnection } from '@/lib/services/stt';
import { createGeminiLiveSession, GeminiLiveSession } from '@/lib/services/gemini-live';
import { LiveTranscript } from '@/components/dashboard/LiveTranscript';
import { AgentFeedback } from '@/components/dashboard/AgentFeedback';
import { SettingsDialog } from '@/components/dashboard/SettingsDialog';
import { ConnectionStatus } from '@/components/dashboard/ConnectionStatus';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, History } from 'lucide-react';
import { LiveConnectionState, LiveTranscriptionEvents, LiveClient } from '@deepgram/sdk';
import { useSettings } from '@/lib/store/settings';
import { createClient } from '@/lib/supabase';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

export default function Dashboard() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState<any[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'transcript' | 'insights'>('transcript');

  const { agents, interventionInterval, sttProvider } = useSettings();
  const supabase = createClient();

  /* Refs */
  const audioCaptureRef = useRef<AudioCapture | null>(null);
  const deepgramRef = useRef<LiveClient | null>(null);
  const deepgramConnectionRef = useRef<any>(null);
  const geminiSessionRef = useRef<GeminiLiveSession | null>(null);
  const transcriptBufferRef = useRef<string>("");
  const isProcessingRef = useRef<boolean>(false);
  const sessionIdRef = useRef<string | null>(null);
  const contextRef = useRef<string>("");

  const { toast } = useToast();

  // Auto-login & Audio Init
  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log("Signing in anonymously...");
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) {
          console.error("Auth Error:", error);
        } else if (data.user) {
          // Set user ID for DB prompt sync
          useSettings.getState().setCurrentUserId(data.user.id);
          useSettings.getState().loadPromptsFromDB();
        }
      } else {
        console.log("User already signed in:", session.user.id);
        // Set user ID for DB prompt sync
        useSettings.getState().setCurrentUserId(session.user.id);
        useSettings.getState().loadPromptsFromDB();
      }
    };
    initAuth();

    audioCaptureRef.current = new AudioCapture();
    return () => {
      audioCaptureRef.current?.stop();
    };
  }, []);

  const processWithGemini = async (textChunk: string) => {
    if (isProcessingRef.current) return;
    if (textChunk.length < 10) return;

    isProcessingRef.current = true;

    const currentPrompts = useSettings.getState().prompts;
    const activeAgents = useSettings.getState().agents;

    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textChunk,
          prompts: currentPrompts,
          activeAgents: activeAgents,
          previousContext: contextRef.current
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Gemini API Error Response:", data);
        return;
      }

      // Update rolling context
      if (data.updatedContext) {
        contextRef.current = data.updatedContext;
        console.log("Orchestrator Context:", data.updatedContext);
      }

      if (data.needsIntervention && data.type !== 'NONE') {
        const agentKey = data.type.toLowerCase() as keyof typeof agents;
        if (agentKey && !agents[agentKey]) return;

        setFeedbacks(prev => [...prev, {
          id: Date.now().toString(),
          type: data.type,
          content: data.content,
          timestamp: Date.now()
        }]);

        if (sessionIdRef.current) {
          await supabase.from('insights').insert({
            session_id: sessionIdRef.current,
            type: data.type,
            content: data.content
          });
        }
      }
    } catch (e: any) {
      console.error("Gemini Process Error:", e);
    } finally {
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 3000); // 3-second cooldown
    }
  };

  const startRecording = async () => {
    try {
      // 0. Ensure Auth & Create Session
      let { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        console.log("User not found, attempting sign in...");
        const { data: authData, error } = await supabase.auth.signInAnonymously();
        if (error) {
          alert("Login failed: " + error.message);
          return;
        }
        user = authData.user;
      }

      if (user) {
        const { data, error } = await supabase.from('sessions').insert({
          user_id: user.id,
          title: `Session ${new Date().toLocaleTimeString()}`,
        }).select().single();

        if (error) {
          console.error("Session Create Error:", error);
          alert("DB Error: " + error.message);
          return;
        }

        if (data) {
          sessionIdRef.current = data.id;
          console.log("Session Started:", data.id);
        }
      }

      const currentProvider = useSettings.getState().sttProvider;

      if (currentProvider === 'gemini') {
        // === GEMINI LIVE PATH ===
        await startGeminiRecording();
      } else {
        // === DEEPGRAM PATH ===
        await startDeepgramRecording();
      }

      setIsRecording(true);
    } catch (err: any) {
      console.error("Failed to start:", err);
      alert("Error starting: " + err.message);
    }
  };

  // Deepgram-specific recording logic
  const startDeepgramRecording = async () => {
    // 1. Token
    const response = await fetch('/api/deepgram/token');
    const { key } = await response.json();
    if (!key) throw new Error("No Deepgram Key");

    // 2. Deepgram connection
    const deepgram = getDeepgramClient();
    const deepgramClient = (window as any).dgClient || deepgram;
    const connection = setupDeepgramConnection(deepgramClient);

    connection.on(LiveTranscriptionEvents.Open, () => {
      connection.on(LiveTranscriptionEvents.Transcript, async (data: any) => {
        const sentence = data.channel.alternatives[0].transcript;
        if (sentence && data.is_final) {
          transcriptBufferRef.current += " " + sentence;

          // Save Transcript Chunk
          if (sessionIdRef.current) {
            const { error } = await supabase.from('transcripts').insert({
              session_id: sessionIdRef.current,
              content: sentence,
              timestamp_offset_ms: Math.floor(data.start * 1000)
            });
            if (error) console.error("Transcript Save Error:", error);

            // Auto-Title
            if (transcript.length === 0 && sentence.length > 5) {
              const newTitle = sentence.slice(0, 40) + (sentence.length > 40 ? "..." : "");
              supabase.from('sessions').update({ title: newTitle }).eq('id', sessionIdRef.current).then(res => {
                if (res.error) console.error("Title Update Error:", res.error);
              });
            }
          }

          if (transcriptBufferRef.current.length > interventionInterval) {
            processWithGemini(transcriptBufferRef.current);
            transcriptBufferRef.current = "";
          }

          setTranscript(prev => [...prev, {
            speaker: data.channel.alternatives[0].words?.[0]?.speaker || 0,
            text: sentence,
            isFinal: true,
            timestamp: Date.now()
          }]);
        }
      });
    });

    deepgramConnectionRef.current = connection;

    // 3. Audio (WebM format for Deepgram)
    audioCaptureRef.current!.onAudioData = (blob) => {
      if (connection.getReadyState() === LiveConnectionState.OPEN) {
        connection.send(blob as Blob);
      }
    };

    await audioCaptureRef.current!.start(undefined, 'webm');
  };

  // Gemini Live-specific recording logic
  const startGeminiRecording = async () => {
    // Fetch API key from server (keeps it secure on server-side)
    const tokenResponse = await fetch('/api/gemini-live/token');
    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      throw new Error(tokenData.error);
    }

    const apiKey = tokenData.key;

    if (!apiKey) {
      throw new Error("Google AI API Key not configured. Please set GOOGLE_GENERATIVE_AI_API_KEY in .env.local");
    }

    // Create Gemini Live session
    const session = await createGeminiLiveSession({
      apiKey,
      onTranscript: (text, speaker) => {
        // Add to transcript UI
        setTranscript(prev => [...prev, {
          speaker: speaker === 'Speaker 1' ? 0 : 1,
          text: text,
          isFinal: true,
          timestamp: Date.now()
        }]);

        // Buffer for AI insights (same as Deepgram flow)
        transcriptBufferRef.current += " " + text;

        console.log(`Buffer size: ${transcriptBufferRef.current.length} / ${interventionInterval}`);

        // Process with AI when buffer is large enough
        if (transcriptBufferRef.current.length > interventionInterval) {
          console.log("Calling processWithGemini with:", transcriptBufferRef.current.substring(0, 100) + "...");
          processWithGemini(transcriptBufferRef.current);
          transcriptBufferRef.current = "";
        }

        // Save to Supabase
        if (sessionIdRef.current && text) {
          supabase.from('transcripts').insert({
            session_id: sessionIdRef.current,
            content: text,
            speaker_label: speaker,
          }).then(({ error }) => {
            if (error) console.error("Transcript Save Error:", error);
          });

          // Auto-Title
          if (transcript.length === 0 && text.length > 5) {
            const newTitle = text.slice(0, 40) + (text.length > 40 ? "..." : "");
            supabase.from('sessions').update({ title: newTitle }).eq('id', sessionIdRef.current).then(res => {
              if (res.error) console.error("Title Update Error:", res.error);
            });
          }
        }
      },
      onError: (error) => {
        console.error("Gemini Live Error:", error);
        toast({
          title: "Gemini Error",
          description: error.message,
          variant: "destructive"
        });
      },
      onOpen: () => {
        console.log("Gemini Live connected");
      },
      onClose: () => {
        console.log("Gemini Live disconnected");
      }
    });

    geminiSessionRef.current = session;

    // Audio (PCM format for Gemini)
    audioCaptureRef.current!.onAudioData = (data) => {
      if (session.isConnected()) {
        session.send(data as ArrayBuffer);
      }
    };

    await audioCaptureRef.current!.start(undefined, 'pcm');
  };

  const stopRecording = async () => {
    audioCaptureRef.current?.stop();

    // Stop Deepgram if active
    deepgramConnectionRef.current?.finish();
    deepgramConnectionRef.current = null;

    // Stop Gemini if active
    geminiSessionRef.current?.close();
    geminiSessionRef.current = null;

    setIsRecording(false);

    // Process remaining buffer (only for Deepgram mode)
    if (transcriptBufferRef.current.length > 5) {
      processWithGemini(transcriptBufferRef.current);
      transcriptBufferRef.current = "";
    }

    if (sessionIdRef.current) {
      await supabase.from('sessions').update({
        ended_at: new Date().toISOString()
      }).eq('id', sessionIdRef.current);

      sessionIdRef.current = null;
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-black text-slate-900 dark:text-slate-100 flex flex-col font-sans mb-24 md:mb-0">
      {/* Header */}
      <header className="flex justify-between items-center p-4 bg-white dark:bg-slate-900 border-b sticky top-0 z-10 shadow-sm">
        <h1 className="text-xl font-bold tracking-tight">Realtime<span className="text-blue-600">Coach</span></h1>
        <div className="flex gap-2 items-center">
          <div className="hidden md:flex gap-2 items-center">
            {!isRecording ? (
              <Button onClick={startRecording} className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-4 shadow-sm mr-2">
                <Mic className="w-4 h-4 mr-2" /> Start
              </Button>
            ) : (
              <Button onClick={stopRecording} variant="destructive" className="rounded-full px-4 animate-pulse mr-2">
                <MicOff className="w-4 h-4 mr-2" /> Stop
              </Button>
            )}
            <ConnectionStatus />
            <Link href="/history">
              <Button variant="ghost" size="icon" className="rounded-full">
                <History className="w-5 h-5 text-slate-600" />
              </Button>
            </Link>
            <SettingsDialog />
          </div>
          <div className="flex md:hidden gap-1">
            <ConnectionStatus />
            <SettingsDialog />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full">
        {/* Mobile: Tab Content */}
        <div className="block md:hidden h-full">
          {activeTab === 'transcript' ? (
            <div className="pb-20">
              <LiveTranscript transcript={transcript} />
            </div>
          ) : (
            <div className="pb-20">
              {feedbacks.length === 0 ? (
                <div className="text-center text-slate-500 mt-10">
                  <p>No insights yet.</p>
                  <p className="text-sm">Speak more to get coaching!</p>
                </div>
              ) : (
                <AgentFeedback feedbacks={feedbacks} />
              )}
            </div>
          )}
        </div>

        {/* Desktop: Grid Layout */}
        <div className="hidden md:grid grid-cols-2 gap-6 h-[calc(100vh-140px)]">
          <section className="h-full border rounded-xl bg-white dark:bg-slate-900 shadow-sm overflow-hidden flex flex-col">
            <div className="p-3 border-b bg-slate-50/50 font-semibold text-slate-500 text-sm">Live Transcript</div>
            <div className="flex-1 overflow-hidden">
              <LiveTranscript transcript={transcript} />
            </div>
          </section>
          <section className="h-full border rounded-xl bg-white dark:bg-slate-900 shadow-sm overflow-hidden flex flex-col">
            <div className="p-3 border-b bg-slate-50/50 font-semibold text-slate-500 text-sm">AI Coach Insights</div>
            <div className="flex-1 overflow-hidden">
              <AgentFeedback feedbacks={feedbacks} />
            </div>
          </section>
        </div>
      </div>

      {/* Mobile Bottom Fixed Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t p-3 flex items-center justify-between z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] safe-area-pb">
        {/* History Link (Mobile) */}
        <Link href="/history">
          <Button variant="ghost" size="icon" className="rounded-full text-slate-500">
            <History className="w-6 h-6" />
          </Button>
        </Link>

        {/* Tab Switchers */}
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-full absolute left-1/2 transform -translate-x-1/2">
          <button
            onClick={() => setActiveTab('transcript')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${activeTab === 'transcript' ? 'bg-white dark:bg-slate-700 shadow text-blue-600' : 'text-slate-500'}`}
          >
            Transcript
          </button>
          <button
            onClick={() => setActiveTab('insights')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${activeTab === 'insights' ? 'bg-white dark:bg-slate-700 shadow text-purple-600' : 'text-slate-500'}`}
          >
            Insights
            {feedbacks.length > 0 && <span className="ml-1 text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full">{feedbacks.length}</span>}
          </button>
        </div>

        {/* Record Button (Floating Action) - Moved to right or center? Let's put it on the right for thumb access */}
        {!isRecording ? (
          <Button onClick={startRecording} size="icon" className="h-12 w-12 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-300 dark:shadow-blue-900/40">
            <Mic className="w-6 h-6 text-white" />
          </Button>
        ) : (
          <Button onClick={stopRecording} size="icon" variant="destructive" className="h-12 w-12 rounded-full animate-pulse shadow-lg shadow-red-300">
            <MicOff className="w-6 h-6 text-white" />
          </Button>
        )}
      </div>

      {/* Desktop Floating Action - Start/Stop is in Header on desktop, which is fine. */}
    </main>
  );
}
