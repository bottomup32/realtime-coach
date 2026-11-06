import { createClient, LiveTranscriptionEvents, type LiveTranscriptionEvent } from "@deepgram/sdk";
import { authHeaders } from "./auth";
import { groupSpeakerWords } from "./speakers";
import type { Utterance } from "./model";

export async function startDiarizedLive(options: {
  onUtterances: (items: Utterance[]) => void; onPartial: (text: string) => void; onStatus: (text: string) => void;
}): Promise<() => Promise<void>> {
  let mic: MediaStream | undefined, audio: AudioContext | undefined, processor: AudioWorkletNode | undefined;
  let connection: ReturnType<ReturnType<typeof createClient>["listen"]["live"]> | undefined;
  let closing = false;
  let stopping = false;
  let keepAlive: ReturnType<typeof setInterval> | undefined;
  let resolveClosed: (() => void) | undefined;
  const closed = new Promise<void>(resolve => { resolveClosed = resolve; });
  const cleanup = async () => {
    if (closing) return; closing = true;
    if (keepAlive) clearInterval(keepAlive);
    try { connection?.requestClose(); } catch { /* already closed */ }
    options.onPartial(""); processor?.disconnect(); mic?.getTracks().forEach(t => t.stop());
    if (audio && audio.state !== "closed") await audio.close();
  };
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("HTTPS 또는 localhost에서 마이크를 사용할 수 있습니다.");
    const headers = await authHeaders();
    mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 }, video: false });
    audio = new AudioContext(); await audio.audioWorklet.addModule("/meeting-pcm.js");
    const response = await fetch("/api/deepgram/token", { method: "POST", headers });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || "화자 분리를 준비하지 못했습니다.");
    const epoch = crypto.randomUUID(); const startedAt = Date.now();
    connection = createClient({ accessToken: data.token }).listen.live({ model: data.model, language: "ko", encoding: "linear16", sample_rate: 16000, channels: 1, diarize: true, punctuate: true, interim_results: true, endpointing: 300 });
    connection.on(LiveTranscriptionEvents.Transcript, (event: LiveTranscriptionEvent) => {
      const alternative = event.channel?.alternatives?.[0];
      if (!alternative?.transcript) return;
      if (!event.is_final) { options.onPartial(alternative.transcript); return; }
      options.onPartial("");
      const grouped = groupSpeakerWords(alternative.words || [], epoch, startedAt);
      options.onUtterances(grouped.length ? grouped : [{ id: crypto.randomUUID(), text: alternative.transcript, at: new Date().toISOString() }]);
    });
    connection.on(LiveTranscriptionEvents.Close, () => { resolveClosed?.(); if (!closing && !stopping) { options.onStatus("화자 분리 연결이 종료됐습니다. 다시 시작 후 내 화자를 확인해 주세요."); void cleanup(); } });
    connection.on(LiveTranscriptionEvents.Error, () => { options.onStatus("화자 분리 연결 오류입니다. 기록은 보존됩니다."); void cleanup(); });
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("화자 분리 연결 시간이 초과됐습니다.")), 12000);
      connection!.on(LiveTranscriptionEvents.Open, () => { clearTimeout(timeout); resolve(); });
      connection!.on(LiveTranscriptionEvents.Error, () => { clearTimeout(timeout); reject(new Error("화자 분리 서비스 연결에 실패했습니다.")); });
      connection!.on(LiveTranscriptionEvents.Close, () => { clearTimeout(timeout); reject(new Error("화자 분리 연결이 닫혔습니다.")); });
    });
    if (closing) throw new Error("화자 분리 연결이 닫혔습니다.");
    processor = new AudioWorkletNode(audio, "meeting-pcm");
    audio.createMediaStreamSource(mic).connect(processor);
    const muted = audio.createGain(); muted.gain.value = 0; processor.connect(muted); muted.connect(audio.destination);
    processor.port.onmessage = ({ data }: MessageEvent<ArrayBuffer>) => { if (!closing && !stopping) { try { connection?.send(data); } catch { options.onStatus("오디오 전송이 중단됐습니다. 다시 시작해 주세요."); void cleanup(); } } };
    keepAlive = setInterval(() => connection?.keepAlive(), 5000);
    await audio.resume(); options.onStatus("녹음 중");
    return async () => {
      stopping = true;
      processor?.disconnect(); mic?.getTracks().forEach(t => t.stop());
      connection?.requestClose();
      let timeout: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([closed, new Promise(resolve => { timeout = setTimeout(resolve, 4000); })]);
      if (timeout) clearTimeout(timeout);
      await cleanup();
    };
  } catch (error) { await cleanup(); connection?.requestClose(); throw error; }
}
