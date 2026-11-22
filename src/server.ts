import 'dotenv/config';
import type { Server } from 'node:http';
import app from './app';
import { connectDatabase, disconnectDatabase } from './config/database';
import { stopAllSimulationWorkers } from './modules/matches/match-simulation.service';

const PORT = Number(process.env.PORT) || 3000;

async function startServer(): Promise<void> {
  try {
    await connectDatabase();

    const server: Server = app.listen(PORT, () => {
      console.log(`[Server] Running on http://localhost:${PORT}`);
    });

    const shutdown = async (signal: string): Promise<void> => {
      console.log(`\n[Server] ${signal} received. Shutting down gracefully...`);
      stopAllSimulationWorkers();
      server.close(async () => {
        await disconnectDatabase();
        process.exit(0);
      });
    };

    process.on('SIGINT', () => {
      void shutdown('SIGINT');
    });

    process.on('SIGTERM', () => {
      void shutdown('SIGTERM');
    });
  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
}

void startServer();
