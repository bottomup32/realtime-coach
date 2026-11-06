export type Utterance = { id: string; text: string; at: string; speakerId?: string; speakerLabel?: string };
export type Card = { id: string; type: "QUESTION" | "INSIGHT" | "ANSWER" | "COACH"; content: string; evidenceIds: string[]; dismissed?: boolean; targetSpeakerId?: string };
export type SummarySnapshot = { id: string; at: string; summary: string; decisions: string[]; actions: string[]; openQuestions: string[] };
export type Meeting = {
  id: string; title: string; goal: string; notes: string; context: string;
  startedAt: string; endedAt?: string; transcript: Utterance[];
  summary: string; decisions: string[]; actions: string[]; openQuestions: string[];
  cards: Card[]; report: string; confirmed: boolean; selfSpeakerId?: string; summaryHistory?: SummarySnapshot[];
};
export type Analysis = Pick<Meeting, "summary" | "decisions" | "actions" | "openQuestions"> & { cards: Card[] };
export function newMeeting(): Meeting {
  return { id: crypto.randomUUID(), title: "새 회의", goal: "", notes: "", context: "", startedAt: new Date().toISOString(), transcript: [], summary: "", decisions: [], actions: [], openQuestions: [], cards: [], report: "", confirmed: false };
}
function strings(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 20 || value.some(v => typeof v !== "string" || v.length > 2000)) throw new Error("잘못된 분석 목록");
  return value;
}
export function parseAnalysis(value: unknown, evidence: Set<string>): Analysis {
  if (!value || typeof value !== "object") throw new Error("분석 결과가 비어 있습니다.");
  const v = value as Record<string, unknown>;
  if (typeof v.summary !== "string" || v.summary.length > 4000 || !Array.isArray(v.cards) || v.cards.length > 3) throw new Error("잘못된 분석 형식");
  const cards: Card[] = v.cards.map((raw: unknown) => {
    if (!raw || typeof raw !== "object") throw new Error("잘못된 카드");
    const c = raw as Record<string, unknown>;
    const ids = strings(c.evidenceIds);
    if (!["QUESTION", "INSIGHT", "ANSWER", "COACH"].includes(String(c.type)) || typeof c.content !== "string" || c.content.length > 1000 || !ids.length || ids.some(id => !evidence.has(id))) throw new Error("근거를 확인할 수 없는 카드");
    return { id: crypto.randomUUID(), type: c.type as Card["type"], content: c.content, evidenceIds: ids };
  });
  return { summary: v.summary, decisions: strings(v.decisions), actions: strings(v.actions), openQuestions: strings(v.openQuestions), cards };
}
export function personalCards(result: Analysis, transcript: Utterance[], selfSpeakerId?: string): Analysis {
  const ownIds = new Set(transcript.filter(t => selfSpeakerId && t.speakerId === selfSpeakerId).map(t => t.id));
  return { ...result, cards: result.cards.filter(c => c.type !== "COACH" || (!!selfSpeakerId && c.evidenceIds.every(id => ownIds.has(id)))).map(c => c.type === "COACH" ? { ...c, targetSpeakerId: selfSpeakerId } : c) };
}
export function applyAnalysis(meeting: Meeting, result: Analysis): Meeting {
  const known = new Set(meeting.cards.map(c => c.content.replace(/\s/g, "")));
  const history = meeting.summaryHistory || [];
  const last = history.at(-1);
  const shouldCapture = result.summary && result.summary !== last?.summary && (!last || Date.now() - Date.parse(last.at) >= 30000 || JSON.stringify(last.decisions) !== JSON.stringify(result.decisions));
  const summaryHistory = shouldCapture ? [...history, { id: crypto.randomUUID(), at: new Date().toISOString(), summary: result.summary, decisions: result.decisions, actions: result.actions, openQuestions: result.openQuestions }].slice(-100) : history;
  return { ...meeting, ...result, summaryHistory, cards: [...meeting.cards, ...result.cards.filter(c => !known.has(c.content.replace(/\s/g, "")))].slice(-50), confirmed: false };
}
export function reportFor(m: Meeting): string {
  const list = (items: string[]) => items.length ? items.map(x => `- ${x}`).join("\n") : "- 확인 필요";
  return `# ${m.title}\n\n## 회의 목적\n${m.goal || "미입력"}\n\n## 핵심 논의\n${m.summary || "아직 생성된 요약이 없습니다."}\n\n## 결정 사항\n${list(m.decisions)}\n\n## 할 일 (담당자·기한 확인 필요)\n${list(m.actions)}\n\n## 미결 사항\n${list(m.openQuestions)}\n\n## 내 메모\n${m.notes}\n`;
}

// A pending update never disappears while an earlier analysis is in flight.
export class AnalysisQueue {
  private pending = false;
  private running: Promise<void> | null = null;
  private work: () => Promise<void>;
  constructor(work: () => Promise<void>) { this.work = work; }
  request(): Promise<void> {
    this.pending = true;
    if (!this.running) this.running = this.drain();
    return this.running;
  }
  private async drain() {
    // Defer once so `running` is assigned even when work completes synchronously.
    await Promise.resolve();
    try { while (this.pending) { this.pending = false; await this.work(); } }
    finally { this.running = null; }
  }
  async flush() { if (this.running) await this.running; }
}
