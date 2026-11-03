class MeetingPCM extends AudioWorkletProcessor {
  constructor() { super(); this.phase = 0; this.samples = []; }
  process(inputs) {
    const channels = inputs[0];
    if (!channels?.length) return true;
    // Average channels, resample using the actual AudioContext rate, emit 100ms PCM.
    for (let i = 0; i < channels[0].length; i++) {
      let sample = 0;
      for (const channel of channels) sample += channel[i] / channels.length;
      this.phase += 16000;
      while (this.phase >= sampleRate) {
        this.phase -= sampleRate;
        const s = Math.max(-1, Math.min(1, sample));
        this.samples.push(Math.round(s * (s < 0 ? 32768 : 32767)));
        if (this.samples.length === 1600) {
          const bytes = new ArrayBuffer(3200); const view = new DataView(bytes);
          this.samples.forEach((value, index) => view.setInt16(index * 2, value, true));
          this.port.postMessage(bytes, [bytes]); this.samples = [];
        }
      }
    }
    return true;
  }
}
registerProcessor("meeting-pcm", MeetingPCM);
