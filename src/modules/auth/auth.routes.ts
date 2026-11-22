import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import {
  loginController,
  meController,
  registerController,
} from './auth.controller';

const authRouter = Router();

authRouter.post('/register', registerController);
authRouter.post('/login', loginController);
authRouter.get('/me', authenticate, meController);

export default authRouter;
