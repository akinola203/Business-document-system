import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a notification for a specified user within a tenant company.
   */
  async createNotification(
    companyId: string,
    userId: string,
    title: string,
    message: string,
    type: string,
    metadata?: Record<string, unknown>,
  ) {
    try {
      const notification = await this.prisma.notification.create({
        data: {
          companyId,
          userId,
          title,
          message,
          type,
          metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
        },
      });

      return notification;
    } catch (error) {
      this.logger.error(`Failed to create notification for user "${userId}": ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Retrieves paginated notifications for the requesting user with unread count.
   */
  async findAll(companyId: string, userId: string, query: QueryNotificationsDto) {
    const { page = 1, limit = 20, unreadOnly = false } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = {
      companyId,
      userId,
      ...(unreadOnly ? { isRead: false } : {}),
    };

    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { companyId, userId, isRead: false },
      }),
    ]);

    return {
      items,
      unreadCount,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Marks an individual notification as read.
   */
  async markAsRead(companyId: string, userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, companyId, userId },
    });

    if (!notification) {
      throw new NotFoundException(`Notification with ID "${id}" not found.`);
    }

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  /**
   * Marks all unread notifications for the user as read.
   */
  async markAllAsRead(companyId: string, userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { companyId, userId, isRead: false },
      data: { isRead: true },
    });

    return { updatedCount: result.count };
  }
}
