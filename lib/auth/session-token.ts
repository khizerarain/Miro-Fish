import { jwtVerify, SignJWT } from "jose";

/** Local-auth session cookie. Shared by proxy.ts and server code, so no server-only imports here. */
export const SESSION_COOKIE = "mf_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function key(secret: string) {
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(userId: string, secret: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(key(secret));
}

export async function verifySessionToken(token: string | undefined, secret: string): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: ["HS256"] });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}
