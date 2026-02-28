import jwt from "jsonwebtoken";
import type { UserRole } from "@/constants/roles";

const JWT_SECRET = (() => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET environment variable is required in production");
    }
    console.warn("WARNING: Using default JWT secret. Set JWT_SECRET in production!");
    return "bugbase-secret-key-change-in-production";
  }
  return secret;
})();
const JWT_EXPIRES_IN = "7d";

export interface JWTPayload {
  id: number;
  email: string;
  role: UserRole;
}

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export function extractToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7);
}
