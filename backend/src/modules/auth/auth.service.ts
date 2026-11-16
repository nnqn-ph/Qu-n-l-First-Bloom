import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { emitSessionRevoked } from '../../websocket/socket.server';

export interface TokenPayload {
  userId: string;
  username: string;
  roleId: string;
  sessionId: string;
}

export class AuthService {
  /**
   * Đăng nhập người dùng & Khởi tạo phiên thiết bị
   */
  async login(username: string, passwordPlain: string, clientIp: string, userAgent: string, customDevice?: string) {
    const user = await prisma.user.findFirst({
      where: {
        username,
        deletedAt: null,
      },
      include: {
        role: true,
      },
    });

    if (!user) {
      throw new Error('Tài khoản hoặc mật khẩu không chính xác');
    }

    if (!user.isActive) {
      throw new Error('Tài khoản đã bị tạm khóa, vui lòng liên hệ Admin');
    }

    const isMatch = await bcrypt.compare(passwordPlain, user.passwordHash);
    if (!isMatch) {
      throw new Error('Tài khoản hoặc mật khẩu không chính xác');
    }

    const sessionId = crypto.randomUUID();
    const tokenPayload: TokenPayload = {
      userId: user.id,
      username: user.username,
      roleId: user.roleId,
      sessionId,
    };

    // 1. Ký Access Token ngắn hạn
    const accessToken = jwt.sign(tokenPayload, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN as any,
    });

    // 2. Ký Refresh Token dài hạn (14 ngày)
    const refreshToken = jwt.sign({ sessionId, userId: user.id }, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN as any,
    });

    // Băm refresh token trước khi lưu vào database
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);

    const deviceInfo = customDevice || userAgent || 'Thiết bị không xác định';

    // 3. Lưu phiên vào cơ sở dữ liệu
    await prisma.userSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshTokenHash,
        deviceInfo: deviceInfo.substring(0, 250),
        ipAddress: clientIp.substring(0, 45) || '127.0.0.1',
        expiresAt,
        isRevoked: false,
      },
    });

    // 4. Ghi nhận Audit Log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        entity: 'USER',
        entityId: user.id,
        ipAddress: clientIp,
        newValues: { sessionId, deviceInfo },
      },
    });

    return {
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        roleId: user.roleId,
        roleName: user.role.name,
      },
      sessionId,
      accessToken,
      refreshToken,
    };
  }

  /**
   * Cấp lại Access Token mới qua Refresh Token
   */
  async refreshAccessToken(refreshToken: string) {
    if (!refreshToken) {
      throw new Error('Không tìm thấy Refresh Token');
    }

    let decoded: { sessionId: string; userId: string };
    try {
      decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { sessionId: string; userId: string };
    } catch {
      throw new Error('Refresh Token không hợp lệ hoặc đã hết hạn');
    }

    const session = await prisma.userSession.findUnique({
      where: { id: decoded.sessionId },
      include: {
        user: {
          include: { role: true },
        },
      },
    });

    if (!session || session.isRevoked || session.expiresAt < new Date()) {
      throw new Error('Phiên đăng nhập đã bị thu hồi hoặc hết hạn');
    }

    if (!session.user.isActive || session.user.deletedAt !== null) {
      throw new Error('Tài khoản người dùng không còn hoạt động');
    }

    // Cập nhật thời gian hoạt động gần nhất
    await prisma.userSession.update({
      where: { id: session.id },
      data: { lastActiveAt: new Date() },
    });

    // Tạo Access Token mới
    const tokenPayload: TokenPayload = {
      userId: session.user.id,
      username: session.user.username,
      roleId: session.user.roleId,
      sessionId: session.id,
    };

    const newAccessToken = jwt.sign(tokenPayload, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN as any,
    });

    return {
      accessToken: newAccessToken,
      user: {
        id: session.user.id,
        username: session.user.username,
        fullName: session.user.fullName,
        roleId: session.user.roleId,
        roleName: session.user.role.name,
      },
    };
  }

  /**
   * Đăng xuất phiên hiện tại
   */
  async logout(sessionId: string, userId?: string) {
    if (sessionId) {
      await prisma.userSession.updateMany({
        where: { id: sessionId },
        data: { isRevoked: true },
      });

      emitSessionRevoked(sessionId);

      if (userId) {
        await prisma.auditLog.create({
          data: {
            userId,
            action: 'LOGOUT',
            entity: 'USER_SESSION',
            entityId: sessionId,
          },
        });
      }
    }
    return true;
  }

  /**
   * Lấy danh sách các phiên đăng nhập đang hoạt động của người dùng
   */
  async getActiveSessions(userId: string, currentSessionId: string) {
    const sessions = await prisma.userSession.findMany({
      where: {
        userId,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastActiveAt: 'desc' },
    });

    return sessions.map((s) => ({
      id: s.id,
      deviceInfo: s.deviceInfo,
      ipAddress: s.ipAddress,
      lastActiveAt: s.lastActiveAt,
      createdAt: s.createdAt,
      isCurrent: s.id === currentSessionId,
    }));
  }

  /**
   * Thu hồi phiên từ xa (Hủy đăng nhập của thiết bị khác)
   */
  async revokeSession(targetSessionId: string, requestUserId: string, isUserAdmin: boolean) {
    const session = await prisma.userSession.findUnique({
      where: { id: targetSessionId },
    });

    if (!session) {
      throw new Error('Phiên đăng nhập không tồn tại');
    }

    if (session.userId !== requestUserId && !isUserAdmin) {
      throw new Error('Bạn không có quyền thu hồi phiên này');
    }

    await prisma.userSession.update({
      where: { id: targetSessionId },
      data: { isRevoked: true },
    });

    // Bắn sự kiện realtime để thiết bị bị thu hồi tự động đá phiên
    emitSessionRevoked(targetSessionId);

    await prisma.auditLog.create({
      data: {
        userId: requestUserId,
        action: 'REVOKE_SESSION',
        entity: 'USER_SESSION',
        entityId: targetSessionId,
      },
    });

    return true;
  }
}

export const authService = new AuthService();
