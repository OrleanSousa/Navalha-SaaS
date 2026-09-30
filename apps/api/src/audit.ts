import { Controller, Get, Injectable, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Prisma, Role } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { TenantContext } from './auth-context';
import { PrismaService } from './prisma.service';
import { requestMetadata } from './request-context';
import { Permissions, PermissionsGuard, RequirePermissions, Roles, RolesGuard } from './rbac';

const SENSITIVE_KEY =
  /password|senha|token|secret|authorization|cookie|cpf|document|card|cvv|email|phone/i;

export function maskSensitive(value: unknown, key = ''): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (SENSITIVE_KEY.test(key)) return '[REDACTED]';
  if (Array.isArray(value)) {
    return value.map((item) => maskSensitive(item) ?? null) as Prisma.InputJsonArray;
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
        childKey,
        maskSensitive(childValue, childKey) ?? null,
      ]),
    ) as Prisma.InputJsonObject;
  }
  if (typeof value === 'bigint') return value.toString();
  return value as Prisma.InputJsonValue;
}

type AuditClient = Pick<PrismaService, 'auditLog'> | Prisma.TransactionClient;

export interface AuditEntry {
  action: string;
  entity: string;
  entityId?: string | null;
  userId?: string | null;
  barbershopId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}

@Injectable()
export class AuditService {
  constructor(private readonly db: PrismaService) {}

  record(entry: AuditEntry, client: AuditClient = this.db) {
    const context = requestMetadata();
    return client.auditLog.create({
      data: {
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        userId: entry.userId,
        barbershopId: entry.barbershopId,
        before:
          entry.before === undefined
            ? undefined
            : (maskSensitive(entry.before) as Prisma.InputJsonValue),
        after:
          entry.after === undefined
            ? undefined
            : (maskSensitive(entry.after) as Prisma.InputJsonValue),
        ip: entry.ip || context?.ip,
        userAgent: context?.userAgent,
        correlationId: context?.correlationId,
      },
    });
  }
}

export class ListAuditLogsQuery {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() action?: string;
  @IsOptional() @IsString() entity?: string;
  @IsOptional() @IsString() userId?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) page = 1;
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) @Max(100) limit = 20;
}

@Controller('audit-logs')
@Roles(Role.ADMIN)
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
export class AuditController {
  constructor(
    private readonly db: PrismaService,
    private readonly tenant: TenantContext,
  ) {}

  @Get()
  @RequirePermissions(Permissions.AUDIT_READ)
  async list(@Query() query: ListAuditLogsQuery) {
    const where: Prisma.AuditLogWhereInput = {
      barbershopId: this.tenant.barbershopId,
      action: query.action ? { equals: query.action, mode: 'insensitive' } : undefined,
      entity: query.entity ? { equals: query.entity, mode: 'insensitive' } : undefined,
      userId: query.userId,
      createdAt:
        query.from || query.to
          ? {
              gte: query.from ? new Date(query.from) : undefined,
              lte: query.to ? new Date(query.to) : undefined,
            }
          : undefined,
      OR: query.search
        ? [
            { action: { contains: query.search, mode: 'insensitive' } },
            { entity: { contains: query.search, mode: 'insensitive' } },
            { entityId: { contains: query.search, mode: 'insensitive' } },
            { user: { name: { contains: query.search, mode: 'insensitive' } } },
          ]
        : undefined,
    };
    const [items, total] = await Promise.all([
      this.db.auditLog.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.db.auditLog.count({ where }),
    ]);
    return { items, total, page: query.page, pages: Math.ceil(total / query.limit) };
  }
}
