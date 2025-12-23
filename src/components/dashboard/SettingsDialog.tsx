
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useSettings, PromptType } from "@/lib/store/settings";
import { Button } from "@/components/ui/button";
import { Settings, Check, Loader2, RotateCcw, Save } from "lucide-react";
import { useState, useEffect, useCallback } from "react";

export function SettingsDialog() {
    const {
        agents, interventionInterval, toggleAgent, setInterval, prompts,
        isSyncing, lastSyncedAt, savePromptToDB, resetPromptToDefault, sttProvider, setSttProvider
    } = useSettings();
    const [activeTab, setActiveTab] = useState<PromptType>('orchestrator');
    const [localPrompt, setLocalPrompt] = useState(prompts[activeTab]);
    const [hasChanges, setHasChanges] = useState(false);

    // Sync local prompt when tab changes
    useEffect(() => {
        setLocalPrompt(prompts[activeTab]);
        setHasChanges(false);
    }, [activeTab, prompts]);

    // Handle prompt changes
    const handlePromptChange = (value: string) => {
        setLocalPrompt(value);
        setHasChanges(value !== prompts[activeTab]);
    };

    // Save prompt to DB
    const handleSavePrompt = async () => {
        await savePromptToDB(activeTab, localPrompt);
        setHasChanges(false);
    };

    // Reset to default
    const handleResetPrompt = async () => {
        if (confirm(`Reset ${activeTab} prompt to default?`)) {
            await resetPromptToDefault(activeTab);
            setLocalPrompt(prompts[activeTab]);
            setHasChanges(false);
        }
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-full">
                    <Settings className="w-4 h-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <DialogTitle>Coach Configuration</DialogTitle>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {isSyncing ? (
                                <>
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    <span>Syncing...</span>
                                </>
                            ) : lastSyncedAt ? (
                                <>
                                    <Check className="w-3 h-3 text-green-500" />
                                    <span>Saved</span>
                                </>
                            ) : null}
                        </div>
                    </div>
                </DialogHeader>
                <div className="grid gap-6 py-4">

                    {/* 0. STT PROVIDER */}
                    <div className="space-y-4">
                        <h4 className="font-medium leading-none">Speech-to-Text Provider</h4>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setSttProvider('gemini')}
                                className={`flex flex-col items-center border p-3 rounded-md transition-all ${sttProvider === 'gemini'
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                        : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                            >
                                <span className="text-sm font-semibold">Gemini Live</span>
                                <span className="text-xs text-muted-foreground">Native Audio AI</span>
                            </button>
                            <button
                                onClick={() => setSttProvider('deepgram')}
                                className={`flex flex-col items-center border p-3 rounded-md transition-all ${sttProvider === 'deepgram'
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                        : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                            >
                                <span className="text-sm font-semibold">Deepgram</span>
                                <span className="text-xs text-muted-foreground">STT + Gemini Coach</span>
                            </button>
                        </div>
                    </div>

                    {/* 1. AGENTS TOGGLE */}
                    <div className="space-y-4">
                        <h4 className="font-medium leading-none">Active Agents</h4>
                        <div className="grid grid-cols-3 gap-2">
                            <div className="flex flex-col items-center border p-2 rounded-md">
                                <span className="mb-2 text-sm font-semibold">Question</span>
                                <Switch checked={agents.question} onCheckedChange={() => toggleAgent('question')} />
                            </div>
                            <div className="flex flex-col items-center border p-2 rounded-md">
                                <span className="mb-2 text-sm font-semibold">Answer</span>
                                <Switch checked={agents.answer} onCheckedChange={() => toggleAgent('answer')} />
                            </div>
                            <div className="flex flex-col items-center border p-2 rounded-md">
                                <span className="mb-2 text-sm font-semibold">Insight</span>
                                <Switch checked={agents.insight} onCheckedChange={() => toggleAgent('insight')} />
                            </div>
                        </div>
                    </div>

                    {/* 2. FREQUENCY */}
                    <div className="space-y-4">
                        <div className="flex justify-between">
                            <h4 className="font-medium leading-none">Intervention Frequency</h4>
                            <span className="text-sm text-muted-foreground">Every ~{interventionInterval} chars</span>
                        </div>
                        <Slider
                            defaultValue={[interventionInterval]}
                            max={1000}
                            min={100}
                            step={50}
                            onValueChange={(vals) => setInterval(vals[0])}
                        />
                    </div>

                    {/* 3. PROMPT EDITOR (Tabs) */}
                    <div className="space-y-4 border-t pt-4">
                        <div className="flex items-center justify-between">
                            <h4 className="font-medium leading-none">Agent Prompts & Persona</h4>
                            <span className="text-xs text-muted-foreground">Saved to cloud ☁️</span>
                        </div>

                        {/* Custom Tabs */}
                        <div className="flex space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                            {(['orchestrator', 'question', 'answer', 'insight'] as const).map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`flex-1 text-xs py-1.5 px-2 rounded-md transition-all capitalize ${activeTab === tab
                                            ? 'bg-white dark:bg-black shadow-sm font-medium text-black dark:text-white'
                                            : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="capitalize text-sm text-slate-500">
                                    {activeTab} Agent Instructions
                                </Label>
                                <div className="flex gap-1">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={handleResetPrompt}
                                        disabled={isSyncing}
                                    >
                                        <RotateCcw className="w-3 h-3 mr-1" />
                                        Default
                                    </Button>
                                    <Button
                                        variant={hasChanges ? "default" : "ghost"}
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={handleSavePrompt}
                                        disabled={isSyncing || !hasChanges}
                                    >
                                        {isSyncing ? (
                                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                        ) : (
                                            <Save className="w-3 h-3 mr-1" />
                                        )}
                                        Save
                                    </Button>
                                </div>
                            </div>
                            <textarea
                                className="w-full h-40 p-3 text-sm border rounded-md bg-slate-50 dark:bg-slate-900 resize-none font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={localPrompt}
                                onChange={(e) => handlePromptChange(e.target.value)}
                                placeholder={`Enter instructions for ${activeTab}...`}
                            />
                            {hasChanges && (
                                <p className="text-xs text-amber-600">⚠️ Unsaved changes</p>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end pt-2 border-t">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                                if (confirm("Reset ALL prompts and settings to default?")) {
                                    useSettings.getState().resetDefaults();
                                }
                            }}
                        >
                            Reset All to Defaults
                        </Button>
                    </div>

                </div>
            </DialogContent>
        </Dialog>
    );
}

