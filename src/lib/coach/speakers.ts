import type { Utterance } from "./model";
export function speakerName(utterance: Utterance) { return utterance.speakerLabel || "화자 미확인"; }
