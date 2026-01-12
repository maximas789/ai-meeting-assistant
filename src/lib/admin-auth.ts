"use server";

import { cookies } from "next/headers";

const ADMIN_PIN = process.env.ADMIN_PIN || "1234";
const SESSION_COOKIE = "admin_session";
const SESSION_DURATION_MS = 30 * 60 * 1000; // 30 minutes

interface SessionData {
  token: string;
  expiresAt: number;
}

// In-memory session store (for production, use Redis or database)
const sessions = new Map<string, SessionData>();

/**
 * Validate the provided PIN against the configured admin PIN
 */
export async function validatePin(pin: string): Promise<boolean> {
  return pin === ADMIN_PIN;
}

/**
 * Create a new admin session and set the session cookie
 */
export async function createSession(): Promise<string> {
  const token = crypto.randomUUID();
  const expiresAt = Date.now() + SESSION_DURATION_MS;

  sessions.set(token, { token, expiresAt });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: SESSION_DURATION_MS / 1000,
    path: "/",
  });

  return token;
}

/**
 * Check if the current request has a valid admin session
 */
export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE);

  if (!sessionCookie?.value) {
    return false;
  }

  const session = sessions.get(sessionCookie.value);

  if (!session) {
    return false;
  }

  // Check if session has expired
  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionCookie.value);
    return false;
  }

  // Extend session on activity
  session.expiresAt = Date.now() + SESSION_DURATION_MS;

  return true;
}

/**
 * Destroy the current admin session
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE);

  if (sessionCookie?.value) {
    sessions.delete(sessionCookie.value);
    cookieStore.delete(SESSION_COOKIE);
  }
}

/**
 * Login with PIN and create a session
 */
export async function login(pin: string): Promise<{ success: boolean; error?: string }> {
  const isValid = await validatePin(pin);

  if (!isValid) {
    return { success: false, error: "Invalid PIN" };
  }

  await createSession();
  return { success: true };
}

/**
 * Logout and destroy the session
 */
export async function logout(): Promise<void> {
  await destroySession();
}

/**
 * Get the remaining session time in milliseconds
 */
export async function getSessionTimeRemaining(): Promise<number | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE);

  if (!sessionCookie?.value) {
    return null;
  }

  const session = sessions.get(sessionCookie.value);

  if (!session) {
    return null;
  }

  const remaining = session.expiresAt - Date.now();
  return remaining > 0 ? remaining : null;
}
