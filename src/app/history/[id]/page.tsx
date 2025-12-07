
"use client";
import React, { useEffect, useState, use } from 'react';
import { createClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ChevronLeft, MessageSquare, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const [transcript, setTranscript] = useState<any[]>([]);
    const [insights, setInsights] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        const loadData = async () => {
            const { data: transcriptsData } = await supabase
                .from('transcripts')
                .select('*')
                .eq('session_id', resolvedParams.id)
                .order('created_at', { ascending: true });

            const { data: insightsData } = await supabase
                .from('insights')
                .select('*')
                .eq('session_id', resolvedParams.id)
                .order('created_at', { ascending: true });

            setTranscript(transcriptsData || []);
            setInsights(insightsData || []);
            setLoading(false);
        };
        loadData();
    }, [resolvedParams.id]);

    const handleDownload = () => {
        const lines = transcript.map(t => `[${new Date(t.created_at).toLocaleTimeString()}] ${t.speaker_label || "Speaker"}: ${t.content}`);
        const text = lines.join('\n');
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `session-${resolvedParams.id.slice(0, 8)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    if (loading) return <div className="p-8">Loading...</div>;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-black p-4 md:p-8">
            <div className="max-w-6xl mx-auto h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center">
                        <Link href="/history">
                            <Button variant="ghost" className="mr-4">
                                <ChevronLeft className="w-4 h-4 mr-2" /> Back
                            </Button>
                        </Link>
                        <h1 className="text-2xl font-bold">Session Report</h1>
                    </div>
                    <Button onClick={handleDownload} variant="outline" size="sm">
                        Download Transcript
                    </Button>
                </div>

                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8 overflow-hidden">
                    {/* Transcript Panel */}
                    <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm overflow-y-auto border">
                        <h2 className="text-lg font-semibold mb-4 flex items-center">
                            <MessageSquare className="w-5 h-5 mr-2 text-blue-500" /> Transcript
                        </h2>
                        <div className="space-y-4">
                            {transcript.map((t) => (
                                <div key={t.id} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                    <div className="text-xs text-slate-500 mb-1">
                                        {t.speaker_label || "Speaker"} • {new Date(t.created_at).toLocaleTimeString()}
                                    </div>
                                    <p className="text-sm dark:text-slate-200">{t.content}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Insights Panel */}
                    <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm overflow-y-auto border">
                        <h2 className="text-lg font-semibold mb-4 flex items-center">
                            <Lightbulb className="w-5 h-5 mr-2 text-amber-500" /> AI Insights
                        </h2>
                        <div className="space-y-4">
                            {insights.map((item) => (
                                <div key={item.id} className={cn(
                                    "p-4 rounded-lg border",
                                    item.type === "QUESTION" && "bg-amber-50 border-amber-100 dark:bg-amber-900/10",
                                    item.type === "ANSWER" && "bg-emerald-50 border-emerald-100 dark:bg-emerald-900/10",
                                    item.type === "INSIGHT" && "bg-purple-50 border-purple-100 dark:bg-purple-900/10"
                                )}>
                                    <div className="text-xs font-bold uppercase mb-1 opacity-70">
                                        {item.type}
                                    </div>
                                    <p className="font-medium text-sm">{item.content}</p>
                                </div>
                            ))}
                            {insights.length === 0 && <div className="text-slate-400">No insights recorded.</div>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
