import { Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { TenantContext } from './auth-context';
import { NotificationsService } from './notifications.service';
import { Permissions, PermissionsGuard, RequirePermissions, Roles, RolesGuard } from './rbac';

@Controller('notifications')
@Roles(Role.ADMIN, Role.RECEPTIONIST, Role.BARBER)
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly tenant: TenantContext,
  ) {}

  @Get()
  @RequirePermissions(Permissions.NOTIFICATIONS_READ)
  list(@Query('unread') unread?: string) {
    return this.notifications.list(this.tenant.barbershopId, unread === 'true');
  }

  @Get('unread-count')
  @RequirePermissions(Permissions.NOTIFICATIONS_READ)
  unreadCount() {
    return this.notifications.unreadCount(this.tenant.barbershopId);
  }

  @Patch(':id/read')
  @RequirePermissions(Permissions.NOTIFICATIONS_MANAGE)
  markRead(@Param('id') id: string) {
    return this.notifications.markRead(this.tenant.barbershopId, id);
  }

  @Post('read-all')
  @RequirePermissions(Permissions.NOTIFICATIONS_MANAGE)
  markAllRead() {
    return this.notifications.markAllRead(this.tenant.barbershopId);
  }

  @Post('process-queue')
  @RequirePermissions(Permissions.NOTIFICATIONS_MANAGE)
  processQueue() {
    return this.notifications.processPending();
  }
}
