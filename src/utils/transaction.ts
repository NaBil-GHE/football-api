import mongoose, { type ClientSession } from 'mongoose';

export async function runInTransaction<T>(
  operation: (session: ClientSession | null) => Promise<T>,
): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await operation(session);
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (
      message.includes('Transaction numbers are only allowed on a replica set member') ||
      message.includes('transactions are not supported')
    ) {
      return await operation(null);
    }
    throw error;
  } finally {
    await session.endSession();
  }
}
