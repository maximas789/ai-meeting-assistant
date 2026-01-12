import { NextRequest, NextResponse } from "next/server";
import {
  login,
  logout,
  isAuthenticated,
  getSessionTimeRemaining,
} from "@/lib/admin-auth";

/**
 * GET /api/admin - Check authentication status
 */
export async function GET() {
  const authenticated = await isAuthenticated();
  const timeRemaining = await getSessionTimeRemaining();

  return NextResponse.json({
    authenticated,
    timeRemaining,
  });
}

/**
 * POST /api/admin - Login with PIN
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pin } = body;

    if (!pin || typeof pin !== "string") {
      return NextResponse.json(
        { success: false, error: "PIN is required" },
        { status: 400 }
      );
    }

    const result = await login(pin);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 401 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request" },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/admin - Logout
 */
export async function DELETE() {
  await logout();
  return NextResponse.json({ success: true });
}
