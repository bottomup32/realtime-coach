import { createClient } from "@deepgram/sdk";
import { authorize } from "@/lib/coach/server";
export async function POST(request: Request) {
  const denied = await authorize(request); if (denied) return denied;
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) return Response.json({ error: "대면 화자 분리에는 서버의 DEEPGRAM_API_KEY 설정이 필요합니다. Gemini 전사만으로는 여러 화자를 자동 구분할 수 없습니다." }, { status: 503 });
  try {
    const { result, error } = await createClient(key).auth.grantToken({ ttl_seconds: 60 });
    if (error || !result?.access_token) throw new Error("Token issuance failed");
    return Response.json({ token: result.access_token, model: process.env.DEEPGRAM_MODEL || "nova-3" }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "화자 분리 연결 토큰을 발급하지 못했습니다. Deepgram 키 권한을 확인해 주세요." }, { status: 502 }); }
}
export async function GET() {
  return Response.json({ error: "이전 키 반환 API는 종료됐습니다. 인증된 POST 요청으로 단기 연결 토큰을 발급하세요." }, { status: 410 });
}
