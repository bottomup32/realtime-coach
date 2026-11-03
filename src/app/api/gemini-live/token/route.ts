import { GoogleGenAI, Modality } from "@google/genai";
import { authorize } from "@/lib/coach/server";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const denied = await authorize(request); if (denied) return denied;
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const model = process.env.GEMINI_LIVE_MODEL;
  if (!apiKey || !model) return Response.json({ error: "GOOGLE_GENERATIVE_AI_API_KEY와 GEMINI_LIVE_MODEL을 설정해 주세요." }, { status: 503 });
  try {
    const config = { responseModalities: [Modality.AUDIO], inputAudioTranscription: {}, systemInstruction: "Listen to this meeting. Do not speak. Transcribe the input audio." };
    const ai = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: "v1alpha", timeout: 10000 } });
    const token = await ai.authTokens.create({ config: { uses: 1, expireTime: new Date(Date.now() + 65 * 60000).toISOString(), newSessionExpireTime: new Date(Date.now() + 60000).toISOString(), liveConnectConstraints: { model, config } } });
    if (!token.name) throw new Error("Empty token");
    return Response.json({ token: token.name, model, config }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Live 토큰 발급에 실패했습니다. 모델 접근권한과 서버 설정을 확인해 주세요." }, { status: 502 }); }
}
// The old GET endpoint must never return a long-lived provider key.
export async function GET() { return Response.json({ error: "인증된 POST 요청을 사용하세요." }, { status: 405 }); }
