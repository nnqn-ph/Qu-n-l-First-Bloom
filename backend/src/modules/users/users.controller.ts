import { Request, Response } from 'express';
import { usersService } from './users.service';
import { createUserSchema, updateUserStatusSchema } from './users.dto';
import { sendSuccess, sendError } from '../../common/response';

export class UsersController {
  async getUsers(req: Request, res: Response) {
    try {
      const users = await usersService.getAllUsers();
      return sendSuccess(res, users, 'Lấy danh sách người dùng thành công');
    } catch (error: any) {
      return sendError(res, error.message, 500);
    }
  }

  async createUser(req: Request, res: Response) {
    try {
      const validated = createUserSchema.parse(req.body);
      const adminUserId = req.user!.id;
      const newUser = await usersService.createUser(validated, adminUserId);
      return sendSuccess(res, newUser, 'Tạo tài khoản nhân viên thành công', 201);
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async toggleStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const validated = updateUserStatusSchema.parse(req.body);
      const adminUserId = req.user!.id;
      const updated = await usersService.toggleUserStatus(id, validated.isActive, adminUserId);
      return sendSuccess(res, updated, 'Cập nhật trạng thái người dùng thành công');
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }
}

export const usersController = new UsersController();
