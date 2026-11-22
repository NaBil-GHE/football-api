import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { AppError } from '../../utils/app-error';
import type { LoginInput, RegisterInput } from './auth.schema';
import { UserModel, type UserDocument, type UserRole } from './user.model';

const SALT_ROUNDS = 12;

export interface JwtUserPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export interface SafeUser {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim().length < 16) {
    throw new AppError(
      'JWT_SECRET environment variable must be configured with at least 16 characters',
      500,
      'AUTH_CONFIG_ERROR',
    );
  }
  return secret;
}

export function toSafeUser(user: UserDocument): SafeUser {
  return {
    _id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function signAccessToken(user: UserDocument): string {
  const secret = getJwtSecret();
  const expiresIn = (process.env.JWT_EXPIRES_IN || '1d') as NonNullable<
    SignOptions['expiresIn']
  >;

  const payload: JwtUserPayload = {
    sub: user._id.toString(),
    email: user.email,
    role: user.role,
  };

  return jwt.sign(payload, secret, { expiresIn });
}

export function verifyAccessToken(token: string): JwtUserPayload {
  const secret = getJwtSecret();
  try {
    const decoded = jwt.verify(token, secret) as JwtUserPayload;
    if (!decoded || !decoded.sub || !decoded.email || !decoded.role) {
      throw new AppError('Invalid authentication token', 401, 'UNAUTHORIZED');
    }
    return decoded;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      'Invalid or expired authentication token',
      401,
      'UNAUTHORIZED',
    );
  }
}

export async function registerUser(
  input: RegisterInput,
): Promise<{ user: SafeUser; token: string }> {
  const existing = await UserModel.findOne({ email: input.email });
  if (existing) {
    throw new AppError(
      'An account with this email already exists',
      409,
      'EMAIL_ALREADY_EXISTS',
    );
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const user = await UserModel.create({
    name: input.name,
    email: input.email,
    passwordHash,
    role: 'viewer',
  });

  const token = signAccessToken(user);
  return { user: toSafeUser(user), token };
}

export async function loginUser(
  input: LoginInput,
): Promise<{ user: SafeUser; token: string }> {
  const user = await UserModel.findOne({ email: input.email }).select(
    '+passwordHash',
  );

  if (!user) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  const isValid = await bcrypt.compare(input.password, user.passwordHash);
  if (!isValid) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  const token = signAccessToken(user);
  return { user: toSafeUser(user), token };
}

export async function getUserById(id: string): Promise<SafeUser> {
  const user = await UserModel.findById(id);
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }
  return toSafeUser(user);
}
