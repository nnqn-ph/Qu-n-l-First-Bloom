import { Request, Response } from 'express';
import { authService } from './auth.service';
import { loginSchema } from './auth.dto';
import { sendSuccess, sendError } from '../../common/response';
import { env } from '../../config/env';

export class AuthController {
  /**
   * Đăng nhập hệ thống
   */
  async login(req: Request, res: Response) {
    try {
      const validated = loginSchema.parse(req.body);
      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'Trình duyệt Web';

      const result = await authService.login(
        validated.username,
        validated.password,
        clientIp,
        userAgent,
        validated.deviceInfo
      );

      // Thiết lập Refresh Token vào HttpOnly Cookie an toàn
      res.cookie('fb_refresh_token', result.refreshToken, {
        httpOnly: true,
        secure: env.COOKIE_SECURE,
        sameSite: env.COOKIE_SAME_SITE,
        maxAge: 14 * 24 * 60 * 60 * 1000, // 14 ngày
      });

      return sendSuccess(
        res,
        {
          user: result.user,
          accessToken: result.accessToken,
          sessionId: result.sessionId,
        },
        'Đăng nhập thành công'
      );
    } catch (error: any) {
      return sendError(res, error.message || 'Lỗi đăng nhập', 400);
    }
  }

  /**
   * Cấp lại Access Token mới (Token Rotation)
   */
  async refresh(req: Request, res: Response) {
    try {
      const refreshToken = req.cookies.fb_refresh_token || req.body.refreshToken;
      if (!refreshToken) {
        return sendError(res, 'Không tìm thấy refresh token trong cookie', 401);
      }

      const result = await authService.refreshAccessToken(refreshToken);
      return sendSuccess(res, result, 'Cấp lại Access Token thành công');
    } catch (error: any) {
      res.clearCookie('fb_refresh_token');
      return sendError(res, error.message || 'Phiên làm việc hết hạn', 401);
    }
  }

  /**
   * Đăng xuất
   */
  async logout(req: Request, res: Response) {
    try {
      const sessionId = req.user?.sessionId;
      const userId = req.user?.id;

      if (sessionId) {
        await authService.logout(sessionId, userId);
      }

      res.clearCookie('fb_refresh_token');
      return sendSuccess(res, { loggedOut: true }, 'Đăng xuất thành công');
    } catch (error: any) {
      return sendError(res, error.message || 'Lỗi khi đăng xuất', 500);
    }
  }

  /**
   * Lấy thông tin user hiện tại
   */
  async getMe(req: Request, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, 'Chưa đăng nhập', 401);
      }
      return sendSuccess(res, req.user, 'Lấy thông tin người dùng thành công');
    } catch (error: any) {
      return sendError(res, error.message, 500);
    }
  }

  /**
   * Xem danh sách các phiên đăng nhập đang hoạt động của người dùng
   */
  async getSessions(req: Request, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, 'Chưa đăng nhập', 401);
      }
      const sessions = await authService.getActiveSessions(req.user.id, req.user.sessionId);
      return sendSuccess(res, sessions, 'Lấy danh sách phiên đăng nhập thành công');
    } catch (error: any) {
      return sendError(res, error.message, 500);
    }
  }

  /**
   * Thu hồi phiên từ xa của một thiết bị cụ thể
   */
  async revokeSession(req: Request, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, 'Chưa đăng nhập', 401);
      }
      const targetSessionId = req.params.id;
      const isUserAdmin = req.user.roleId === 'ADMIN';

      await authService.revokeSession(targetSessionId, req.user.id, isUserAdmin);
      return sendSuccess(res, { revoked: true }, 'Đã thu hồi phiên đăng nhập thành công');
    } catch (error: any) {
      return sendError(res, error.message || 'Lỗi thu hồi phiên', 400);
    }
  }
}

export const authController = new AuthController();
