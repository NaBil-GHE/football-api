import mongoose from 'mongoose';

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
