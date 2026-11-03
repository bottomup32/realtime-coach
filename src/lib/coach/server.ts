import { createClient } from "@supabase/supabase-js";
export async function authorize(request: Request): Promise<Response | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return Response.json({ error: "실시간 AI를 사용하려면 Supabase 인증 설정이 필요합니다. 메모와 수동 전사는 사용할 수 있습니다." }, { status: 503 });
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { data, error } = await createClient(url, key).auth.getUser(token);
  if (error || !data.user) return Response.json({ error: "인증이 만료되었습니다." }, { status: 401 });
  return null;
}
export async function limitedJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("요청이 비었습니다.");
  let size = 0; const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > 64000) { await reader.cancel(); throw new Error("요청은 64KB 이하여야 합니다."); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
