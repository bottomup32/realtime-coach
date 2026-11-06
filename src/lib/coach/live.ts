import { GoogleGenAI, type LiveServerMessage, type Session } from "@google/genai";
import { authHeaders } from "./auth";
export async function startLive(options: {
  tabAudio: boolean;
  onText: (text: string) => void;
  onStatus: (message: string) => void;
}): Promise<() => Promise<void>> {
  const streams: MediaStream[] = [];
  let audio: AudioContext | undefined;
  let session: Session | undefined;
  let processor: AudioWorkletNode | undefined;
  let closing = false;
  let text = "";
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => { if (timer) clearTimeout(timer); timer = undefined; if (text.trim()) options.onText(text.trim()); text = ""; };
  const cleanup = async () => {
    if (closing) return;
    closing = true; flush(); processor?.disconnect();
    streams.forEach(s => s.getTracks().forEach(t => t.stop()));
    session?.close(); if (audio && audio.state !== "closed") await audio.close();
  };
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("HTTPS 또는 localhost에서 마이크를 사용할 수 있습니다.");
    // Capture permissions before network awaits so the browser's user gesture remains valid.
    if (options.tabAudio) {
      const tab = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      streams.push(tab);
      if (!tab.getAudioTracks().length) throw new Error("공유 대상의 오디오가 없습니다. 탭 오디오 공유를 선택해 주세요.");
      tab.getVideoTracks().forEach(t => t.addEventListener("ended", () => { options.onStatus("화면 공유가 종료됐습니다. 녹음을 다시 시작해 주세요."); void cleanup(); }));
    }
    const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
    streams.push(mic);
    const response = await fetch("/api/gemini-live/token", { method: "POST", headers: await authHeaders(true) });
    const token = await response.json();
    if (!response.ok) throw new Error(token.error || "Live 연결을 준비하지 못했습니다.");
    const ai = new GoogleGenAI({ apiKey: token.token, httpOptions: { apiVersion: "v1alpha" } });
    session = await ai.live.connect({ model: token.model, config: token.config, callbacks: {
      onmessage: (message: LiveServerMessage) => {
        const chunk = message.serverContent?.inputTranscription?.text;
        // Emit during continuous speech too; restarting the timer would wait forever.
        if (chunk) { text += chunk; if (!timer) timer = setTimeout(flush, 1000); }
        if (message.serverContent?.turnComplete) flush();
      },
      onerror: () => { options.onStatus("음성 연결 오류입니다. 전사는 보존됩니다. 녹음을 다시 시작해 주세요."); void cleanup(); },
      onclose: () => { if (!closing) { options.onStatus("음성 연결이 종료됐습니다. 녹음을 다시 시작해 주세요."); void cleanup(); } },
    } });
    if (closing) throw new Error("음성 연결이 닫혔습니다.");
    audio = new AudioContext();
    await audio.audioWorklet.addModule("/meeting-pcm.js");
    processor = new AudioWorkletNode(audio, "meeting-pcm");
    const mixer = audio.createGain(); mixer.gain.value = 1 / streams.length;
    for (const stream of streams) audio.createMediaStreamSource(new MediaStream(stream.getAudioTracks())).connect(mixer);
    mixer.connect(processor);
    const silent = audio.createGain(); silent.gain.value = 0; processor.connect(silent); silent.connect(audio.destination);
    processor.port.onmessage = ({ data }: MessageEvent<ArrayBuffer>) => {
      if (closing) return;
      const bytes = new Uint8Array(data); let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      try { session?.sendRealtimeInput({ audio: { data: btoa(binary), mimeType: "audio/pcm;rate=16000" } }); }
      catch { options.onStatus("오디오 전송이 중단됐습니다. 다시 시작해 주세요."); void cleanup(); }
    };
    await audio.resume();
    options.onStatus("녹음 중");
    return async () => {
      if (closing) return;
      processor?.disconnect();
      try { session?.sendRealtimeInput({ audioStreamEnd: true }); } catch { /* already closed */ }
      await new Promise(resolve => setTimeout(resolve, 700));
      await cleanup();
    };
  } catch (error) { await cleanup(); throw error; }
}
