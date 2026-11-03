export async function GET() {
  return Response.json({ error: "이전 키 반환 API는 종료됐습니다. 인증된 Gemini Live 단기 토큰 경로를 사용하세요." }, { status: 410 });
}
