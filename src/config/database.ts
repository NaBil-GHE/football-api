import mongoose from 'mongoose';

const READY_STATE_LABELS: Record<number, string> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

export interface DatabaseHealth {
  connected: boolean;
  state: string;
}

export async function connectDatabase(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error('MONGODB_URI is not defined in environment variables.');
  }

  mongoose.connection.on('connected', () => {
    console.log('[DB] Connected to MongoDB');
  });

  mongoose.connection.on('error', (error: Error) => {
    console.error('[DB] MongoDB connection error:', error.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[DB] Disconnected from MongoDB');
  });

  await mongoose.connect(mongoUri);
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  const readyState = mongoose.connection.readyState;
  const state = READY_STATE_LABELS[readyState] ?? 'unknown';

  if (readyState !== 1 || !mongoose.connection.db) {
    return {
      connected: false,
      state,
    };
  }

  try {
    await mongoose.connection.db.admin().ping();
    return {
      connected: true,
      state,
    };
  } catch {
    return {
      connected: false,
      state: 'unreachable',
    };
  }
}
