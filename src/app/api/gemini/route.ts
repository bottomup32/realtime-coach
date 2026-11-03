export async function POST() {
  return Response.json({ error: "이전 코칭 API는 종료됐습니다. /api/coach/analyze를 사용하세요." }, { status: 410 });
}
