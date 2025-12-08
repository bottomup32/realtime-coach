
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { AudioCapture } from '@/lib/audio/capture';
import { getDeepgramClient, setupDeepgramConnection } from '@/lib/services/stt';
import { LiveTranscript } from '@/components/dashboard/LiveTranscript';
import { AgentFeedback } from '@/components/dashboard/AgentFeedback';
import { SettingsDialog } from '@/components/dashboard/SettingsDialog';
import { ConnectionStatus } from '@/components/dashboard/ConnectionStatus';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, History } from 'lucide-react';
import { LiveConnectionState, LiveTranscriptionEvents } from '@deepgram/sdk';
import { useSettings } from '@/lib/store/settings';
import { createClient } from '@/lib/supabase';
import Link from 'next/link';

export default function Dashboard() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState<any[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'transcript' | 'insights'>('transcript');

  const { agents, interventionInterval } = useSettings();
  const supabase = createClient();

  const audioCaptureRef = useRef<AudioCapture | null>(null);
  const deepgramConnectionRef = useRef<any>(null);
  const transcriptBufferRef = useRef<string>("");
  const sessionIdRef = useRef<string | null>(null);

  // Auto-login
  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log("Signing in anonymously...");
        const { error } = await supabase.auth.signInAnonymously();
        if (error) console.error("Auth Error:", error);
      } else {
        console.log("User already signed in:", session.user.id);
      }
    };
    initAuth();

    audioCaptureRef.current = new AudioCapture();
    return () => {
      audioCaptureRef.current?.stop();
    };
  }, []);

  const isProcessingRef = useRef(false);

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
          activeAgents: activeAgents
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Gemini API Error Response:", data);
        return;
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

      // 1. Token
      const response = await fetch('/api/deepgram/token');
      const { key } = await response.json();
      if (!key) throw new Error("No Deepgram Key");

      // 2. Deepgram
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

              // Auto-Title: Update session title with first sentence
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

      // 3. Audio
      audioCaptureRef.current!.onAudioData = (blob) => {
        if (connection.getReadyState() === LiveConnectionState.OPEN) {
          connection.send(blob);
        }
      };

      await audioCaptureRef.current!.start();
      setIsRecording(true);
    } catch (err: any) {
      console.error("Failed to start:", err);
      alert("Error starting: " + err.message);
    }
  };

  const stopRecording = async () => {
    audioCaptureRef.current?.stop();
    deepgramConnectionRef.current?.finish();
    setIsRecording(false);

    // Process remaining buffer
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
