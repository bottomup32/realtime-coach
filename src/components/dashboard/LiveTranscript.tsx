
"use client";
import React, { useEffect, useRef } from 'react';
import { cn } from "@/lib/utils";

interface TranscriptItem {
    speaker: number;
    text: string;
    isFinal: boolean;
    timestamp: number;
}

interface LiveTranscriptProps {
    transcript: TranscriptItem[];
}

export function LiveTranscript({ transcript }: LiveTranscriptProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [showScrollBtn, setShowScrollBtn] = React.useState(false);

    const scrollToBottom = () => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            setShowScrollBtn(false);
        }
    };

    const handleScroll = () => {
        if (!scrollRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
        // Show button if we are more than 100px away from bottom
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
        setShowScrollBtn(!isNearBottom);
    };

    useEffect(() => {
        // Auto-scroll only if we are already near bottom
        if (scrollRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
            const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
            if (isNearBottom) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
        }
    }, [transcript]);

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden relative">
            <h2 className="text-lg font-semibold mb-2 text-slate-800 dark:text-slate-100 flex items-center">
                <span className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></span>
                Live Transcript
            </h2>

            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto space-y-2 pr-2"
                onScroll={handleScroll}
            >
                {transcript.length === 0 && (
                    <div className="text-center text-slate-400 mt-10 italic text-sm">
                        Waiting for speech...
                    </div>
                )}

                {transcript.map((item, idx) => {
                    const isSameSpeaker = idx > 0 && transcript[idx - 1].speaker === item.speaker;
                    return (
                        <div key={idx} className={cn(
                            "rounded-lg px-3 py-2 max-w-[85%] text-sm",
                            item.speaker === 0 ? "bg-blue-100 dark:bg-blue-900/30 ml-auto" : "bg-gray-100 dark:bg-slate-800 mr-auto",
                            isSameSpeaker ? "mt-1" : "mt-3"
                        )}>
                            {!isSameSpeaker && (
                                <div className="text-[10px] text-slate-500 mb-0.5 font-bold opacity-70">
                                    {item.speaker === 0 ? "ME" : `SPEAKER ${item.speaker}`}
                                </div>
                            )}
                            <p className={cn("leading-snug", !item.isFinal && "opacity-70 italic")}>
                                {item.text}
                            </p>
                        </div>
                    );
                })}
            </div>

            {showScrollBtn && (
                <button
                    onClick={scrollToBottom}
                    className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white text-xs px-3 py-1.5 rounded-full shadow-lg hover:bg-blue-700 transition animate-in fade-in slide-in-from-bottom-2"
                >
                    Scroll to Bottom ↓
                </button>
            )}
        </div>
    );
}
