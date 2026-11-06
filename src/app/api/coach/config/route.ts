export const dynamic = "force-dynamic";

// Supabase's anon/publishable key is public by design. Never return server keys.
export async function GET() {
  const runtime = process.env;
  const url = runtime.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = runtime.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const missing = [
    "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "GOOGLE_GENERATIVE_AI_API_KEY", "GEMINI_LIVE_MODEL", "GEMINI_COACH_MODEL",
  ].filter(name => !runtime[name]?.trim());
  let validPublicKey = !!anonKey?.startsWith("sb_publishable_");
  if (anonKey && !validPublicKey) {
    try { validPublicKey = JSON.parse(Buffer.from(anonKey.split(".")[1], "base64url").toString()).role === "anon"; }
    catch { /* A secret key or malformed key must never be exposed. */ }
  }
  let validUrl = false;
  try { const parsed = new URL(url || ""); validUrl = ["https:", "http:"].includes(parsed.protocol) && !parsed.username && !parsed.password; } catch { /* missing or malformed */ }
  return Response.json({
    supabase: validUrl && validPublicKey ? { url, anonKey } : null,
    missing,
    diarizationReady: !!runtime.DEEPGRAM_API_KEY?.trim(),
    invalidPublicConfig: !!(url && anonKey) && !(validUrl && validPublicKey),
    aiReady: missing.length === 0 && validUrl && validPublicKey,
  }, { headers: { "Cache-Control": "no-store" } });
}
