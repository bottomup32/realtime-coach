
"use client";
import React from 'react';
import { Lightbulb, MessageCircle, HelpCircle } from 'lucide-react';
import { cn } from "@/lib/utils";

export type AgentType = "QUESTION" | "ANSWER" | "INSIGHT" | "NONE";

interface FeedbackItem {
    id: string;
    type: AgentType;
    content: string;
    timestamp: number;
}

interface AgentFeedbackProps {
    feedbacks: FeedbackItem[];
}

export function AgentFeedback({ feedbacks }: AgentFeedbackProps) {
    return (
        <div className="flex flex-col h-full">
            <h2 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-100">AI Coach Insights</h2>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {feedbacks.map((item) => (
                    <div key={item.id} className={cn(
                        "p-4 rounded-xl border shadow-sm transition-all animate-in slide-in-from-right-5 fade-in duration-300",
                        item.type === "QUESTION" && "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800",
                        item.type === "ANSWER" && "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800",
                        item.type === "INSIGHT" && "bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800"
                    )}>
                        <div className="flex items-start gap-3">
                            <div className="mt-1">
                                {item.type === "QUESTION" && <HelpCircle className="w-5 h-5 text-amber-600" />}
                                {item.type === "ANSWER" && <MessageCircle className="w-5 h-5 text-emerald-600" />}
                                {item.type === "INSIGHT" && <Lightbulb className="w-5 h-5 text-purple-600" />}
                            </div>
                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-wider opacity-70 mb-1">
                                    {item.type}
                                </h3>
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                    {item.content}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
                {feedbacks.length === 0 && (
                    <div className="text-center text-slate-400 mt-10 text-sm">
                        Listening for coaching opportunities...
                    </div>
                )}
            </div>
        </div>
    );
}
