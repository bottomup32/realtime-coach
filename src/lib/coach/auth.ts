import { createClient } from "@/lib/supabase";
export async function authHeaders(): Promise<Record<string, string>> {
  // Read server runtime configuration, not only NEXT_PUBLIC values frozen at build.
  const response = await fetch("/api/coach/config", { cache: "no-store" });
  if (!response.ok) throw new Error("서버 설정을 확인하지 못했습니다. 실행 중인 서버와 접속 주소를 확인해 주세요.");
  const config = await response.json();
  if (config.invalidPublicConfig) throw new Error("Supabase URL 또는 공개 키 형식이 올바르지 않습니다. anon/publishable 키를 사용하고 service_role/secret 키는 넣지 마세요.");
  if (!config.supabase) throw new Error("실행 중인 서버에 Supabase 설정이 없습니다. npm run dev를 실행한 폴더의 .env.local에 URL·공개 키를 넣고 서버를 재시작해 주세요. 중첩 폴더에서 실행 중인지도 확인하세요.");
  if (config.missing.length) throw new Error(`서버에 필요한 설정이 빠졌습니다: ${config.missing.join(", ")}. .env.local을 확인한 뒤 서버를 재시작해 주세요.`);
  const client = createClient(config.supabase);
  let { data: { session } } = await client.auth.getSession();
  if (!session) {
    const result = await client.auth.signInAnonymously();
    if (result.error) throw new Error(`Supabase 로그인 실패: ${result.error.message}. Supabase에서 Anonymous Sign-In을 활성화했는지 확인해 주세요.`);
    session = result.data.session;
  }
  if (!session) throw new Error("로그인에 실패했습니다.");
  return { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" };
}
