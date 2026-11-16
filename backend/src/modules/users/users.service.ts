import bcrypt from 'bcryptjs';
import { prisma } from '../../config/prisma';
import { CreateUserDto } from './users.dto';

export class UsersService {
  /**
   * Lấy danh sách toàn bộ người dùng trong tiệm (Chỉ Admin)
   */
  async getAllUsers() {
    const users = await prisma.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        username: true,
        fullName: true,
        phone: true,
        roleId: true,
        isActive: true,
        createdAt: true,
        role: {
          select: { name: true, description: true },
        },
        _count: {
          select: {
            sessions: { where: { isRevoked: false, expiresAt: { gt: new Date() } } },
            orders: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((u) => ({
      id: u.id,
      username: u.username,
      fullName: u.fullName,
      phone: u.phone,
      roleId: u.roleId,
      roleName: u.role.name,
      isActive: u.isActive,
      activeSessionsCount: u._count.sessions,
      totalOrdersCount: u._count.orders,
      createdAt: u.createdAt,
    }));
  }

  /**
   * Tạo tài khoản nhân viên mới (Chỉ Admin)
   */
  async createUser(dto: CreateUserDto, adminUserId: string) {
    const existing = await prisma.user.findUnique({
      where: { username: dto.username },
    });

    if (existing) {
      throw new Error(`Tên đăng nhập '${dto.username}' đã tồn tại trong hệ thống`);
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await prisma.user.create({
      data: {
        username: dto.username,
        passwordHash,
        fullName: dto.fullName,
        phone: dto.phone,
        roleId: dto.roleId,
        isActive: true,
      },
      include: { role: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'CREATE_USER',
        entity: 'USER',
        entityId: user.id,
        newValues: { username: user.username, roleId: user.roleId },
      },
    });

    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      phone: user.phone,
      roleId: user.roleId,
      roleName: user.role.name,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }

  /**
   * Khóa hoặc kích hoạt lại tài khoản nhân viên (Chỉ Admin)
   */
  async toggleUserStatus(userId: string, isActive: boolean, adminUserId: string) {
    if (userId === adminUserId && !isActive) {
      throw new Error('Admin không thể tự khóa tài khoản của chính mình');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('Người dùng không tồn tại');
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isActive },
    });

    // Nếu khóa tài khoản, lập tức hủy tất cả các phiên đăng nhập đang mở
    if (!isActive) {
      await prisma.userSession.updateMany({
        where: { userId, isRevoked: false },
        data: { isRevoked: true },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
        entity: 'USER',
        entityId: userId,
      },
    });

    return { id: userId, isActive };
  }
}

export const usersService = new UsersService();
