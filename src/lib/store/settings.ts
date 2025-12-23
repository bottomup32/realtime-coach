
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AgentConfig {
    enabled: boolean;
    frequency: number; // 0-10 (Sensitivity)
}

export type SttProvider = 'deepgram' | 'gemini';
export type PromptType = 'orchestrator' | 'question' | 'answer' | 'insight';

const DEFAULT_PROMPTS: Record<PromptType, string> = {
    orchestrator: `역할: 오케스트레이터 (Chief of Staff)

당신은 실시간 회의를 모니터링하며 3명의 전문 에이전트를 관리하는 총괄 코디네이터입니다.

[당신의 역할]
1. 회의 내용을 듣고 짧게 요약 (2문장 이내)
2. 필요한 경우 적절한 에이전트에게 작업 위임
3. 에이전트의 응답을 사용자에게 전달

[에이전트 호출 기준]
- QUESTION: 사용자가 막혀있거나, 검증되지 않은 가정이 있거나, 더 깊은 사고가 필요할 때
- ANSWER: 명확한 질문이 있거나, 사실 확인/정보가 필요할 때
- INSIGHT: 중요한 결정, 액션 아이템, 핵심 개념이 나왔을 때
- NONE: 자연스러운 대화 흐름 - 개입 불필요

[원칙]
- 기본값은 NONE (개입 안 함)
- 개입할 때는 명확한 가치가 있어야 함
- 한국어로 응답`,

    question: `역할: 질문 전문가 에이전트 🤔

오케스트레이터가 당신을 호출했습니다. 사용자의 사고를 확장시키는 질문을 생성하세요.

[컨텍스트]
오케스트레이터가 전달한 회의 요약과 현재 상황을 참고하세요.

[당신의 임무]
- 검증되지 않은 가정을 짚어주는 질문
- 놓친 관점을 발견하게 하는 질문
- 더 깊이 생각하게 만드는 소크라테스식 질문

[출력 규칙]
- 한국어로 작성
- 딱 하나의 질문만
- "혹시 ~는 고려해보셨나요?", "만약 ~라면 어떨까요?" 형태
- 최대 20단어`,

    answer: `역할: 답변 전문가 에이전트 📚

오케스트레이터가 당신을 호출했습니다. 사용자의 질문에 정확하고 유용한 답변을 제공하세요.

[컨텍스트]
오케스트레이터가 전달한 회의 요약과 사용자의 질문을 참고하세요.

[당신의 임무]
- 질문에 대한 직접적인 답변
- 필요시 용어 정의, 사실 확인
- 관련 정보 보충

[출력 규칙]
- 한국어로 작성
- 핵심만 2-3문장
- 불확실한 정보는 "~일 수 있습니다" 표현
- 가능하면 구체적 예시 포함`,

    insight: `역할: 인사이트 전문가 에이전트 💡

오케스트레이터가 당신을 호출했습니다. 대화에서 핵심 가치를 추출하세요.

[컨텍스트]
오케스트레이터가 전달한 회의 요약과 최근 대화 내용을 참고하세요.

[당신의 임무]
- 중요 결정사항 포착
- 액션 아이템 식별
- 핵심 키워드/개념 정리

[출력 규칙]
- 한국어로 작성
- 다음 형식 중 하나 선택:
  • 💡 핵심: [핵심 인사이트]
  • 📌 액션: [실행 항목]
  • 🔑 키워드: [중요 개념]
- 최대 2개 포인트
- 각 포인트 10단어 이내`
};

interface SettingsState {
    agents: {
        question: boolean;
        answer: boolean;
        insight: boolean;
    };
    interventionInterval: number;
    hasSeenWelcome: boolean;
    sttProvider: SttProvider;
    prompts: Record<PromptType, string>;

    // DB Sync state
    isSyncing: boolean;
    lastSyncedAt: Date | null;
    currentUserId: string | null;

    // Actions
    toggleAgent: (agent: 'question' | 'answer' | 'insight') => void;
    setInterval: (val: number) => void;
    setWelcomeSeen: () => void;
    setPrompt: (type: PromptType, text: string) => void;
    setSttProvider: (provider: SttProvider) => void;
    resetDefaults: () => void;

    // DB Actions
    setCurrentUserId: (userId: string | null) => void;
    loadPromptsFromDB: () => Promise<void>;
    savePromptToDB: (type: PromptType, text: string) => Promise<void>;
    resetPromptToDefault: (type: PromptType) => Promise<void>;
}

export const useSettings = create<SettingsState>()(
    persist(
        (set, get) => ({
            agents: {
                question: true,
                answer: true,
                insight: true,
            },
            interventionInterval: 300,
            hasSeenWelcome: false,
            sttProvider: 'gemini' as SttProvider,
            prompts: { ...DEFAULT_PROMPTS },

            // DB Sync state
            isSyncing: false,
            lastSyncedAt: null,
            currentUserId: null,

            toggleAgent: (agent) => set((state) => ({
                agents: { ...state.agents, [agent]: !state.agents[agent] }
            })),
            setInterval: (val) => set({ interventionInterval: val }),
            setWelcomeSeen: () => set({ hasSeenWelcome: true }),
            setPrompt: (type, text) => set((state) => ({
                prompts: { ...state.prompts, [type]: text }
            })),
            setSttProvider: (provider) => set({ sttProvider: provider }),

            resetDefaults: () => set({
                sttProvider: 'gemini' as SttProvider,
                agents: { question: true, answer: true, insight: true },
                interventionInterval: 300,
                prompts: { ...DEFAULT_PROMPTS }
            }),

            // DB Actions
            setCurrentUserId: (userId) => set({ currentUserId: userId }),

            loadPromptsFromDB: async () => {
                const { currentUserId } = get();
                if (!currentUserId) return;

                set({ isSyncing: true });
                try {
                    const response = await fetch('/api/prompts');
                    const data = await response.json();

                    if (data.prompts) {
                        set({
                            prompts: data.prompts,
                            lastSyncedAt: new Date(),
                            isSyncing: false
                        });
                    }
                } catch (error) {
                    console.error('Failed to load prompts from DB:', error);
                    set({ isSyncing: false });
                }
            },

            savePromptToDB: async (type, text) => {
                const { currentUserId } = get();

                // Always update local state immediately
                set((state) => ({
                    prompts: { ...state.prompts, [type]: text }
                }));

                if (!currentUserId) return;

                set({ isSyncing: true });
                try {
                    const response = await fetch('/api/prompts', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type, content: text, userId: currentUserId })
                    });

                    if (response.ok) {
                        set({ lastSyncedAt: new Date() });
                    }
                } catch (error) {
                    console.error('Failed to save prompt to DB:', error);
                } finally {
                    set({ isSyncing: false });
                }
            },

            resetPromptToDefault: async (type) => {
                const { currentUserId } = get();
                const defaultContent = DEFAULT_PROMPTS[type];

                // Reset local state
                set((state) => ({
                    prompts: { ...state.prompts, [type]: defaultContent }
                }));

                if (!currentUserId) return;

                set({ isSyncing: true });
                try {
                    await fetch('/api/prompts', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type, userId: currentUserId })
                    });
                    set({ lastSyncedAt: new Date() });
                } catch (error) {
                    console.error('Failed to reset prompt:', error);
                } finally {
                    set({ isSyncing: false });
                }
            },
        }),
        {
            name: 'realtime-coach-settings',
        }
    )
);

export { DEFAULT_PROMPTS };

