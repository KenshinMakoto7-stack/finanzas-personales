import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "./firebase-admin";

export async function withAuth(
  req: NextRequest,
  handler: (userId: string) => Promise<NextResponse>
): Promise<NextResponse> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(authHeader.slice(7));
    return handler(decoded.uid);
  } catch {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }
}
