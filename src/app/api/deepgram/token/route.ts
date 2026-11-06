// Tombstone for older clients. No provider credentials are used or returned.
export async function GET() { return Response.json({ error: "사용하지 않는 전사 API입니다." }, { status: 410 }); }
export const POST = GET;
