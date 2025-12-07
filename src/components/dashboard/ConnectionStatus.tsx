
"use client";

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { Wifi, WifiOff } from 'lucide-react';

export function ConnectionStatus() {
    const [status, setStatus] = useState<'loading' | 'connected' | 'error'>('loading');
    const [msg, setMsg] = useState('Connecting...');

    useEffect(() => {
        const supabase = createClient();

        const check = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setStatus('connected');
                setMsg('DB Connected');
            } else {
                // Try one ping
                const { error } = await supabase.from('sessions').select('count', { count: 'exact', head: true });
                if (!error || error.code === 'PGRST116') { // RLS might return no rows but no connection error
                    setStatus('connected'); // Actually if no session, RLS hides rows, but connection is OK.
                    setMsg('DB Online (Guest)');
                } else {
                    setStatus('error');
                    setMsg('DB Error');
                }
            }
        };
        check();

        // Subscribe to auth changes
        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            if (session) {
                setStatus('connected');
                setMsg('DB Connected');
            } else {
                setStatus('error'); // Or guest?
                setMsg('Auth Missing');
            }
        });

        return () => {
            authListener.subscription.unsubscribe();
        }
    }, []);

    const isConnected = status === 'connected';

    return (
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${isConnected ? 'bg-white/50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
            {isConnected ? (
                <Wifi className="w-3 h-3 text-emerald-600" />
            ) : (
                <WifiOff className="w-3 h-3 text-red-600" />
            )}
            <span className={`text-xs font-medium ${isConnected ? "text-emerald-700" : "text-red-700"}`}>
                {msg}
            </span>
        </div>
    );
}
