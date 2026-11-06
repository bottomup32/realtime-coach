import type { Utterance } from "./model";
export type SpeakerWord = { word: string; punctuated_word?: string; speaker?: number; start?: number };
export function groupSpeakerWords(words: SpeakerWord[], session: string, startedAt: number): Utterance[] {
  const groups: Utterance[] = [];
  for (const word of words) {
    const known = Number.isInteger(word.speaker) && word.speaker! >= 0;
    const speakerId = known ? `${session}:${word.speaker}` : undefined;
    const label = known ? `Speaker ${word.speaker! < 26 ? String.fromCharCode(65 + word.speaker!) : word.speaker! + 1}` : "화자 미확인";
    const text = word.punctuated_word || word.word;
    if (!text) continue;
    const last = groups.at(-1);
    if (last && last.speakerId === speakerId) last.text += ` ${text}`;
    else groups.push({ id: crypto.randomUUID(), text, at: new Date(startedAt + (word.start || 0) * 1000).toISOString(), speakerId, speakerLabel: label });
  }
  return groups;
}
export function speakerName(utterance: Utterance) { return utterance.speakerLabel || "화자 미확인"; }
