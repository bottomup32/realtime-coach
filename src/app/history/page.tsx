
"use client";
import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
import { ChevronLeft, Calendar, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function HistoryPage() {
    const [sessions, setSessions] = useState<any[]>([]);
    const supabase = createClient();

    useEffect(() => {
        fetchSessions();
    }, []);

    const fetchSessions = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase
                .from('sessions')
                .select('*')
                .eq('user_id', user.id)
                .order('started_at', { ascending: false });
            setSessions(data || []);
        }
    };

    const deleteSession = async (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!confirm("Are you sure you want to delete this session?")) return;

        const { error } = await supabase.from('sessions').delete().eq('id', id);
        if (!error) {
            setSessions(prev => prev.filter(s => s.id !== id));
        } else {
            alert("Failed to delete: " + error.message);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-black p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center mb-8">
                    <Link href="/">
                        <Button variant="ghost" className="mr-4">
                            <ChevronLeft className="w-4 h-4 mr-2" /> Back
                        </Button>
                    </Link>
                    <h1 className="text-3xl font-bold">Session History</h1>
                </div>

                <div className="grid gap-4">
                    {sessions.map(session => (
                        <Link href={`/history/${session.id}`} key={session.id}>
                            <Card className="hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors cursor-pointer group relative">
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1 pr-8">
                                            <div className="flex items-center text-slate-500 mb-2">
                                                <Calendar className="w-4 h-4 mr-2" />
                                                <span className="text-sm">
                                                    {new Date(session.started_at).toLocaleString()}
                                                </span>
                                            </div>
                                            <CardTitle className="line-clamp-1">{session.title}</CardTitle>
                                            <CardDescription>
                                                ID: {session.id.slice(0, 8)}...
                                            </CardDescription>
                                        </div>

                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-600 hover:bg-red-50 absolute right-4 top-4"
                                            onClick={(e) => deleteSession(session.id, e)}
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </Button>
                                    </div>
                                </CardHeader>
                            </Card>
                        </Link>
                    ))}

                    {sessions.length === 0 && (
                        <div className="text-center py-20 text-slate-400">
                            No recorded sessions yet.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
