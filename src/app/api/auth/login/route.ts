import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb, sanitizeUser } from "@/lib/db";
import { SESSION_COOKIE_NAME, signSessionToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const db = await getDb();
    const user = db.users.find((u) => u.email.toLowerCase() === email);

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const safeUser = sanitizeUser(user);
    const token = signSessionToken(safeUser);

    const response = NextResponse.json({
      user: safeUser,
      token,
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 14, // 14 days
    });

    return response;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json(
      { error: "Internal server error during sign in." },
      { status: 500 }
    );
  }
}
