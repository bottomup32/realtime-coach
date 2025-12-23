export type AudioOutputFormat = 'webm' | 'pcm';

export class AudioCapture {
    mediaStream: MediaStream | null = null;
    audioContext: AudioContext | null = null;
    processor: ScriptProcessorNode | null = null;
    source: MediaStreamAudioSourceNode | null = null;
    mediaRecorder: MediaRecorder | null = null;
    outputFormat: AudioOutputFormat = 'webm';

    // Callback for audio data (Blob for webm, ArrayBuffer for pcm)
    onAudioData: ((data: Blob | ArrayBuffer) => void) | null = null;

    async start(deviceId?: string, format: AudioOutputFormat = 'webm'): Promise<void> {
        this.outputFormat = format;

        try {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: deviceId ? { exact: deviceId } : undefined,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 1,
                    sampleRate: format === 'pcm' ? 16000 : undefined, // 16kHz for Gemini
                },
            });

            if (format === 'webm') {
                // WebM/Opus for Deepgram
                this.startWebmRecording();
            } else {
                // Raw PCM for Gemini (16-bit, 16kHz, mono)
                this.startPcmRecording();
            }

        } catch (err) {
            console.error("Error accessing microphone:", err);
            throw err;
        }
    }

    private startWebmRecording() {
        if (!this.mediaStream) return;

        this.mediaRecorder = new MediaRecorder(this.mediaStream, {
            mimeType: 'audio/webm;codecs=opus',
        });

        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0 && this.onAudioData) {
                this.onAudioData(event.data);
            }
        };

        this.mediaRecorder.start(250); // 250ms chunks
    }

    private startPcmRecording() {
        if (!this.mediaStream) return;

        // Create AudioContext at 16kHz sample rate for Gemini
        this.audioContext = new AudioContext({ sampleRate: 16000 });
        this.source = this.audioContext.createMediaStreamSource(this.mediaStream);

        // ScriptProcessorNode for PCM extraction (deprecated but widely supported)
        // Buffer size: 4096 samples = ~256ms at 16kHz
        const bufferSize = 4096;
        this.processor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

        this.processor.onaudioprocess = (e) => {
            if (!this.onAudioData) return;

            const inputData = e.inputBuffer.getChannelData(0);
            // Convert Float32 (-1 to 1) to Int16 (-32768 to 32767)
            const pcmData = this.float32ToInt16(inputData);
            this.onAudioData(pcmData.buffer as ArrayBuffer);
        };

        this.source.connect(this.processor);
        this.processor.connect(this.audioContext.destination);
    }

    private float32ToInt16(float32Array: Float32Array): Int16Array {
        const int16Array = new Int16Array(float32Array.length);
        for (let i = 0; i < float32Array.length; i++) {
            // Clamp to [-1, 1] and scale to Int16 range
            const s = Math.max(-1, Math.min(1, float32Array[i]));
            int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        return int16Array;
    }

    stop() {
        // Stop MediaRecorder if used
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
            this.mediaRecorder = null;
        }

        // Stop AudioContext processing if used
        if (this.processor) {
            this.processor.disconnect();
            this.processor = null;
        }
        if (this.source) {
            this.source.disconnect();
            this.source = null;
        }
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        // Stop media stream
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
    }
}
