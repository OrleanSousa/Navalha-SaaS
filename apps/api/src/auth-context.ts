import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Scope,
  UnauthorizedException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import type { Request } from 'express';

export interface AuthenticatedUser {
  sub: string;
  barbershopId: string | null;
  role: string;
  name: string;
  permissions: string[];
  iat?: number;
  exp?: number;
}

export type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) throw new UnauthorizedException('Usuário não autenticado');
    return request.user;
  },
);

@Injectable({ scope: Scope.REQUEST })
export class TenantContext {
  constructor(@Inject(REQUEST) private readonly request: AuthenticatedRequest) {}

  get user(): AuthenticatedUser {
    if (!this.request.user) throw new UnauthorizedException('Usuário não autenticado');
    return this.request.user;
  }

  get userId(): string {
    return this.user.sub;
  }

  get barbershopId(): string {
    const barbershopId = this.user.barbershopId;
    if (!barbershopId) throw new ForbiddenException('Usuário sem acesso a uma barbearia');
    return barbershopId;
  }
}
