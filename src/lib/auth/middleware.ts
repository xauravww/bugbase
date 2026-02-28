import { NextRequest, NextResponse } from "next/server";
import { extractToken, verifyToken, type JWTPayload } from "./jwt";
import { ROLE_PERMISSIONS, type UserRole } from "@/constants/roles";

export type AuthenticatedRequest = NextRequest & {
  user: JWTPayload;
};

export function getAuthUser(request: NextRequest): JWTPayload | null {
  const authHeader = request.headers.get("authorization");
  let token = extractToken(authHeader);

  if (!token && request.nextUrl) {
    token = request.nextUrl.searchParams.get("token");
  }

  if (!token) {
    return null;
  }

  return verifyToken(token);
}

export function withAuth(
  handler: (request: AuthenticatedRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const user = getAuthUser(request);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    (request as AuthenticatedRequest).user = user;
    return handler(request as AuthenticatedRequest);
  };
}

export function withRole(
  roles: UserRole[],
  handler: (request: AuthenticatedRequest) => Promise<NextResponse>
) {
  return withAuth(async (request: AuthenticatedRequest) => {
    if (!roles.includes(request.user.role)) {
      return NextResponse.json(
        { error: "Forbidden", code: "FORBIDDEN" },
        { status: 403 }
      );
    }
    return handler(request);
  });
}

export function hasPermission(role: UserRole, permission: keyof typeof ROLE_PERMISSIONS.Admin): boolean {
  return ROLE_PERMISSIONS[role]?.[permission] ?? false;
}

export function withPermission(
  permission: keyof typeof ROLE_PERMISSIONS.Admin,
  handler: (request: AuthenticatedRequest) => Promise<NextResponse>
) {
  return withAuth(async (request: AuthenticatedRequest) => {
    if (!hasPermission(request.user.role, permission)) {
      return NextResponse.json(
        { error: "Forbidden", code: "FORBIDDEN" },
        { status: 403 }
      );
    }
    return handler(request);
  });
}
