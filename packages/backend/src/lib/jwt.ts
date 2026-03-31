import { jwtVerify } from 'jose';
import { env } from '../config/env.js';

interface JWTPayload {
  sub: string; // user ID
  email?: string;
  role?: string;
}

/**
 * Verify a JWT token and return the payload.
 * Compatible with Supabase-issued JWTs (HS256) and any standard HS256 JWT.
 */
export async function verifyJWT(token: string): Promise<JWTPayload> {
  const secret = new TextEncoder().encode(env.JWT_SECRET);

  const { payload } = await jwtVerify(token, secret, {
    algorithms: ['HS256'],
  });

  if (!payload.sub) throw new Error('JWT missing sub claim');

  return {
    sub: payload.sub,
    email: payload.email as string | undefined,
    role: payload.role as string | undefined,
  };
}
