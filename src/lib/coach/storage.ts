import type { Meeting } from "./model";
const key = "meeting-copilot:v1";
function validMeeting(value: unknown): value is Meeting {
  if (!value || typeof value !== "object") return false;
  const m = value as Record<string, unknown>;
  return ["id", "title", "goal", "notes", "context", "startedAt", "summary", "report"].every(k => typeof m[k] === "string")
    && typeof m.confirmed === "boolean" && (m.endedAt === undefined || typeof m.endedAt === "string")
    && ["decisions", "actions", "openQuestions"].every(k => Array.isArray(m[k]) && (m[k] as unknown[]).every(v => typeof v === "string"))
    && Array.isArray(m.transcript) && m.transcript.every(t => t && typeof t.id === "string" && typeof t.text === "string" && typeof t.at === "string")
    && Array.isArray(m.cards) && m.cards.every(c => c && typeof c.id === "string" && typeof c.content === "string" && ["QUESTION", "INSIGHT", "ANSWER"].includes(c.type) && Array.isArray(c.evidenceIds) && c.evidenceIds.every((id: unknown) => typeof id === "string"));
}
export function loadMeetings(): Meeting[] {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  const data: unknown = JSON.parse(raw);
  if (!Array.isArray(data) || !data.every(validMeeting)) throw new Error("저장된 회의 형식을 읽을 수 없습니다. 기존 데이터는 보존했습니다.");
  return data;
}
export function saveMeeting(meeting: Meeting) {
  const meetings = loadMeetings();
  localStorage.setItem(key, JSON.stringify([meeting, ...meetings.filter(m => m.id !== meeting.id)]));
}
export function deleteMeeting(id: string) {
  localStorage.setItem(key, JSON.stringify(loadMeetings().filter(m => m.id !== id)));
}
