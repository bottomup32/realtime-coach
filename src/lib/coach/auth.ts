import { createClient } from "@/lib/supabase";
export async function authHeaders(): Promise<Record<string, string>> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) throw new Error("Supabase 설정이 없습니다. 지금은 메모와 수동 전사를 사용할 수 있습니다.");
  const client = createClient();
  let { data: { session } } = await client.auth.getSession();
  if (!session) {
    const result = await client.auth.signInAnonymously();
    if (result.error) throw new Error(result.error.message);
    session = result.data.session;
  }
  if (!session) throw new Error("로그인에 실패했습니다.");
  return { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" };
}
