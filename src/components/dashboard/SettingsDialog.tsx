
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useSettings } from "@/lib/store/settings";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { useState } from "react";

export function SettingsDialog() {
    const { agents, interventionInterval, toggleAgent, setInterval, prompts, setPrompt } = useSettings();
    const [activeTab, setActiveTab] = useState<'orchestrator' | 'question' | 'answer' | 'insight'>('orchestrator');

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-full">
                    <Settings className="w-4 h-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Coach Configuration</DialogTitle>
                </DialogHeader>
                <div className="grid gap-6 py-4">

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
                        <p className="text-xs text-muted-foreground">Slow down if you encounter Rate Limit errors.</p>
                    </div>

                    {/* 3. PROMPT EDITOR (Tabs) */}
                    <div className="space-y-4 border-t pt-4">
                        <h4 className="font-medium leading-none">Agent Prompts & Persona</h4>

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
                            <Label className="capitalize text-sm text-slate-500">
                                {activeTab} Agent Instructions
                            </Label>
                            <textarea
                                className="w-full h-40 p-3 text-sm border rounded-md bg-slate-50 dark:bg-slate-900 resize-none font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={prompts[activeTab]}
                                onChange={(e) => setPrompt(activeTab, e.target.value)}
                                placeholder={`Enter instructions for ${activeTab}...`}
                            />
                            <p className="text-[10px] text-slate-400">
                                Tip: Be specific about the output style and constraints.
                            </p>
                        </div>
                    </div>

                    <div className="flex justify-end pt-2 border-t">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                                if (confirm("Reset all prompts and settings to default?")) {
                                    useSettings.getState().resetDefaults();
                                }
                            }}
                        >
                            Reset to Defaults
                        </Button>
                    </div>

                </div>
            </DialogContent>
        </Dialog>
    );
}
