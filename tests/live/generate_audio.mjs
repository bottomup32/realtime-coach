// Generates synthetic speech only. Uses the configured Gemini key without logging it.
import { GoogleGenAI } from '@google/genai';
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is required');
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY, httpOptions: { timeout: 40000 } });
try {
  const result = await ai.models.generateContent({
    model: 'gemini-2.5-flash-preview-tts',
    contents: '다음 회의 발언을 자연스러운 한국어로 읽어주세요: 오늘은 프로젝트 출시 일정을 정하겠습니다. 다음 금요일까지 첫 번째 버전을 출시하기로 합시다. 그런데 담당자는 아직 정하지 않았습니다. 누가 최종 확인을 맡을지도 정해야 합니다. 예산은 다음 회의에서 다시 논의하겠습니다.',
    config: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } } },
  });
  const audio = result.candidates?.[0]?.content?.parts?.find(part => part.inlineData?.data)?.inlineData;
  if (!audio?.data || !audio.mimeType?.includes('rate=24000')) throw new Error('Expected 24kHz PCM audio');
  writeFileSync('/tmp/meeting-validation.pcm', Buffer.from(audio.data, 'base64'), { mode: 0o600 });
  execFileSync('ffmpeg', ['-hide_banner','-loglevel','error','-f','s16le','-ar','24000','-ac','1','-i','/tmp/meeting-validation.pcm','-ar','48000','/tmp/meeting-validation.wav','-y']);
  execFileSync('ffmpeg', ['-hide_banner','-loglevel','error','-i','/tmp/meeting-validation.wav','-af','adelay=4000,apad=pad_dur=8','/tmp/meeting-validation-padded.wav','-y']);
  console.log('Generated synthetic Korean meeting fixture in /tmp.');
} catch (error) {
  console.error(JSON.stringify({ success: false, status: error.status, errorType: error.constructor.name }));
  process.exitCode = 1;
}
