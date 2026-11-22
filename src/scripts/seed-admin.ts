import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { UserModel } from '../modules/auth/user.model';

async function seedAdmin(): Promise<void> {
  const name = process.env.ADMIN_NAME?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!name || !email || !password) {
    throw new Error(
      'ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD must be set in environment variables.',
    );
  }

  if (password.length < 8) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters long.');
  }

  await connectDatabase();

  try {
    const existing = await UserModel.findOne({ email });
    if (existing) {
      if (existing.role !== 'admin') {
        existing.role = 'admin';
        await existing.save();
        console.log(`[Seed] Promoted existing user "${email}" to admin.`);
      } else {
        console.log(`[Seed] Admin user "${email}" already exists.`);
      }
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await UserModel.create({
      name,
      email,
      passwordHash,
      role: 'admin',
    });
    console.log(`[Seed] Admin user "${email}" created successfully.`);
  } finally {
    await disconnectDatabase();
  }
}

void seedAdmin().catch((error: unknown) => {
  console.error('[Seed] Failed to seed admin:', error);
  process.exit(1);
});
