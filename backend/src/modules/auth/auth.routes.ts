import { Router } from 'express';
import { authController } from './auth.controller';
import { authenticate } from '../../middlewares/auth.middleware';

export const authRouter = Router();

// Public routes
authRouter.post('/login', (req, res) => authController.login(req, res));
authRouter.post('/refresh', (req, res) => authController.refresh(req, res));

// Authenticated routes
authRouter.post('/logout', authenticate, (req, res) => authController.logout(req, res));
authRouter.get('/me', authenticate, (req, res) => authController.getMe(req, res));
authRouter.get('/sessions', authenticate, (req, res) => authController.getSessions(req, res));
authRouter.delete('/sessions/:id', authenticate, (req, res) => authController.revokeSession(req, res));
