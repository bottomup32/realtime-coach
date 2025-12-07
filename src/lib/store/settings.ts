
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AgentConfig {
    enabled: boolean;
    frequency: number; // 0-10 (Sensitivity)
}

interface SettingsState {
    agents: {
        question: boolean;
        answer: boolean;
        insight: boolean;
    };
    interventionInterval: number; // in characters, approx
    hasSeenWelcome: boolean;
    prompts: {
        orchestrator: string;
        question: string;
        answer: string;
        insight: string;
    };

    toggleAgent: (agent: 'question' | 'answer' | 'insight') => void;
    setInterval: (val: number) => void;
    setWelcomeSeen: () => void;
    setPrompt: (type: 'orchestrator' | 'question' | 'answer' | 'insight', text: string) => void;
    resetDefaults: () => void;
}

export const useSettings = create<SettingsState>()(
    persist(
        (set) => ({
            agents: {
                question: true,
                answer: true,
                insight: true,
            },
            interventionInterval: 300,
            hasSeenWelcome: false,
            prompts: {
                orchestrator: `Role: Chief of Staff (Orchestrator).
Context: You are monitoring a real-time meeting.
Tasks:
1. Summarize the ongoing context briefly.
2. Delegate: Decide if the user needs a "Question" (to expand thinking), an "Answer" (to a factual query), or an "Insight" (to capture value).
3. Synthesize: Provide a single, concise, high-impact feedback message to the user.`,
                question: `Role: Question Agent.
Task: Listen to the user's statements. Identify logical gaps, assumptions, or areas for deeper exploration.
Output: Propose ONE powerful, Socratic question to stimulate the user's thinking.`,
                answer: `Role: Answer Agent.
Task: Detect any questions asked or terms that need definition.
Output: Provide a direct, factual, and concise answer using your broad knowledge base. If no question is asked, provide a relevant fact or definition related to the context.`,
                insight: `Role: Insight Agent.
Task: Analyze the discussion for key takeaways.
Output: Extract 1-2 important Keywords, Action Items, or Creative Ideas mentioned or implied by the conversation.`
            },

            toggleAgent: (agent) => set((state) => ({
                agents: { ...state.agents, [agent]: !state.agents[agent] }
            })),
            setInterval: (val) => set({ interventionInterval: val }),
            setWelcomeSeen: () => set({ hasSeenWelcome: true }),
            setPrompt: (type, text) => set((state) => ({
                prompts: { ...state.prompts, [type]: text }
            })),
            resetDefaults: () => set({
                agents: { question: true, answer: true, insight: true },
                interventionInterval: 300,
                prompts: {
                    orchestrator: `Role: Chief of Staff (Orchestrator).
Context: You are monitoring a real-time meeting.
Tasks:
1. Summarize the ongoing context briefly.
2. Delegate: Decide if the user needs a "Question" (to expand thinking), an "Answer" (to a factual query), or an "Insight" (to capture value).
3. Synthesize: Provide a single, concise, high-impact feedback message to the user.`,
                    question: `Role: Question Agent.
Task: Listen to the user's statements. Identify logical gaps, assumptions, or areas for deeper exploration.
Output: Propose ONE powerful, Socratic question to stimulate the user's thinking.`,
                    answer: `Role: Answer Agent.
Task: Detect any questions asked or terms that need definition.
Output: Provide a direct, factual, and concise answer using your broad knowledge base. If no question is asked, provide a relevant fact or definition related to the context.`,
                    insight: `Role: Insight Agent.
Task: Analyze the discussion for key takeaways.
Output: Extract 1-2 important Keywords, Action Items, or Creative Ideas mentioned or implied by the conversation.`
                }
            }),
        }),
        {
            name: 'realtime-coach-settings',
        }
    )
);

