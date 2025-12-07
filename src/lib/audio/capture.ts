export class AudioCapture {
    mediaStream: MediaStream | null = null;
    audioContext: AudioContext | null = null;
    processor: ScriptProcessorNode | null = null;
    source: MediaStreamAudioSourceNode | null = null;

    // Callback for audio data
    onAudioData: ((data: Blob) => void) | null = null;

    async start(deviceId?: string): Promise<void> {
        try {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: deviceId ? { exact: deviceId } : undefined,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 1, // Mono is usually fine for STT, but Deepgram supports stereo if needed
                },
            });

            // Using MediaRecorder for simpler chunking suitable for many STT services
            // OR AudioContext + ScriptProcessor/Worklet for raw PCM (Preferred for Deepgram usually)
            // For this MVP, let's use a simple MediaRecorder approach first as it's more stable across browsers
            // BUT Deepgram WebSocket expects separate handling.
            // Let's use the MediaRecorder API which outputs WebM/Opus, which Deepgram supports.
            // It handles compression nicely.

            const mediaRecorder = new MediaRecorder(this.mediaStream, {
                mimeType: 'audio/webm;codecs=opus', // Standard
            });

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0 && this.onAudioData) {
                    this.onAudioData(event.data);
                }
            };

            mediaRecorder.start(250); // 250ms chunks

        } catch (err) {
            console.error("Error accessing microphone:", err);
            throw err;
        }
    }

    stop() {
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
    }
}
