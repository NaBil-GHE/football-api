import type { AddressInfo } from 'node:net';
import bcrypt from 'bcryptjs';
import type { Express } from 'express';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { signAccessToken } from '../../src/modules/auth/auth.service';
import { UserModel } from '../../src/modules/auth/user.model';

let replSet: MongoMemoryReplSet | null = null;

export async function setupTestDb(): Promise<string> {
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'test-only-jwt-secret-key-min-32-chars';
  }

  if (process.env.TEST_MONGODB_URI) {
    process.env.MONGODB_URI = process.env.TEST_MONGODB_URI;
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.TEST_MONGODB_URI);
    }
    return process.env.TEST_MONGODB_URI;
  }

  if (!replSet) {
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1 },
    });
  }

  const uri = replSet.getUri();
  process.env.MONGODB_URI = uri;

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }

  return uri;
}

export async function createTestAdminHeaders(): Promise<Record<string, string>> {
  const passwordHash = await bcrypt.hash('TestAdmin123!', 4);
  const admin = await UserModel.create({
    name: 'Test Admin',
    email: `admin-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`,
    passwordHash,
    role: 'admin',
  });

  const token = signAccessToken(admin);
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function clearTestDb(): Promise<void> {
  if (mongoose.connection.readyState !== 1) {
    return;
  }

  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    const collection = collections[key];
    if (collection) {
      await collection.deleteMany({});
    }
  }
}

export async function teardownTestDb(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  if (replSet) {
    await replSet.stop();
    replSet = null;
  }
}

export async function startTestServer(
  expressApp: Express,
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  return await new Promise((resolve) => {
    const server = expressApp.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo;
      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () =>
          new Promise<void>((res, rej) => {
            server.close((err) => (err ? rej(err) : res()));
          }),
      });
    });
  });
}
