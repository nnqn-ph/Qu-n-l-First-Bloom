import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { sendError } from '../common/response';
import { TokenPayload } from '../modules/auth/auth.service';

export interface AuthenticatedUser {
  id: string;
  username: string;
  roleId: string;
  sessionId: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Middleware xác thực Access Token và kiểm tra trạng thái phiên
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 'Yêu cầu xác thực tài khoản (Thiếu Bearer Token)', 401);
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;

    // Kiểm tra xem phiên này có bị Admin hoặc người dùng thu hồi từ xa chưa
    const session = await prisma.userSession.findUnique({
      where: { id: payload.sessionId },
      select: { isRevoked: true, expiresAt: true },
    });

    if (!session || session.isRevoked || session.expiresAt < new Date()) {
      return sendError(res, 'Phiên đăng nhập đã bị thu hồi hoặc hết hạn, vui lòng đăng nhập lại', 401);
    }

    req.user = {
      id: payload.userId,
      username: payload.username,
      roleId: payload.roleId,
      sessionId: payload.sessionId,
    };

    next();
  } catch {
    return sendError(res, 'Access Token không hợp lệ hoặc đã hết hạn', 401);
  }
}

/**
 * Middleware kiểm tra quyền hạn theo vai trò (RBAC Guard)
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, 'Yêu cầu đăng nhập', 401);
    }

    if (!allowedRoles.includes(req.user.roleId)) {
      return sendError(
        res,
        `Bạn không có quyền thực hiện thao tác này. Yêu cầu quyền: [${allowedRoles.join(', ')}]`,
        403
      );
    }

    next();
  };
}
