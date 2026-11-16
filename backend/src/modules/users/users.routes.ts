import { Router } from 'express';
import { usersController } from './users.controller';
import { authenticate, requireRole } from '../../middlewares/auth.middleware';

export const usersRouter = Router();

// Tất cả các route bên dưới bắt buộc quyền ADMIN
usersRouter.use(authenticate, requireRole('ADMIN'));

usersRouter.get('/', (req, res) => usersController.getUsers(req, res));
usersRouter.post('/', (req, res) => usersController.createUser(req, res));
usersRouter.patch('/:id/status', (req, res) => usersController.toggleStatus(req, res));
