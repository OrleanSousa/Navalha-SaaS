import {
  Body,
  Controller,
  Get,
  HttpCode,
  Injectable,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { IsEmail, IsString, Matches, MinLength } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from './prisma.service';
import { AuthenticatedUser, CurrentUser } from './auth-context';
import { Role } from '@prisma/client';

const COOKIE = 'navalha_refresh';
const REFRESH_DAYS = 7;
const RESET_MINUTES = 30;
const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

export class LoginDto {
  @IsEmail() email: string;
  @IsString() @MinLength(6) password: string;
}
export class ChangePasswordDto {
  @IsString() currentPassword: string;
  @IsString()
  @MinLength(8)
  @Matches(STRONG_PASSWORD, {
    message: 'A senha deve conter maiúscula, minúscula, número e símbolo',
  })
  newPassword: string;
}
export class ForgotPasswordDto {
  @IsEmail() email: string;
}
export class ResetPasswordDto {
  @IsString() @MinLength(32) token: string;
  @IsString()
  @MinLength(8)
  @Matches(STRONG_PASSWORD, {
    message: 'A senha deve conter maiúscula, minúscula, número e símbolo',
  })
  newPassword: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'development-secret-change-me',
    });
  }
  validate(payload: unknown) {
    return payload;
  }
}

@Injectable()
export class AuthService {
  constructor(
    private db: PrismaService,
    private jwt: JwtService,
  ) {}

  private hash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
  private publicUser(user: any, permissions: string[]) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      barbershop: user.barbershop?.name,
      permissions,
    };
  }
  private access(user: any, permissions: string[]) {
    return this.jwt.signAsync(
      {
        sub: user.id,
        barbershopId: user.barbershopId,
        role: user.role,
        name: user.name,
        permissions,
      },
      { expiresIn: '15m' },
    );
  }
  private assertBarbershopAccess(barbershop: any) {
    if (!barbershop) return;
    if (['SUSPENDED', 'CANCELLED'].includes(barbershop.status)) {
      throw new UnauthorizedException('Barbearia indisponível');
    }
    const subscription = barbershop.subscription;
    if (!subscription || !['ACTIVE', 'TRIAL', 'PAST_DUE'].includes(subscription.status)) {
      throw new UnauthorizedException('Assinatura indisponível');
    }
    const deadline =
      subscription.status === 'TRIAL' ? subscription.trialEndsAt : subscription.expiresAt;
    if (
      deadline &&
      deadline <= new Date() &&
      (!subscription.graceEndsAt || subscription.graceEndsAt <= new Date())
    ) {
      throw new UnauthorizedException('Assinatura expirada');
    }
  }
  async createSession(user: any, request: Request) {
    const [rolePermissions, userPermissions] = await Promise.all([
      this.db.rolePermission.findMany({
        where: { role: user.role as Role },
        select: { permission: { select: { key: true } } },
      }),
      this.db.userPermission.findMany({
        where: { userId: user.id },
        select: { granted: true, permission: { select: { key: true } } },
      }),
    ]);
    const effective = new Set(rolePermissions.map(({ permission }: any) => permission.key));
    for (const override of userPermissions) {
      if (override.granted) effective.add(override.permission.key);
      else effective.delete(override.permission.key);
    }
    const permissions = [...effective];
    const refreshToken = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + REFRESH_DAYS * 86400000);
    await this.db.session.create({
      data: {
        userId: user.id,
        tokenHash: this.hash(refreshToken),
        expiresAt,
        userAgent: request.get('user-agent'),
        ip: request.ip,
      },
    });
    return {
      refreshToken,
      expiresAt,
      accessToken: await this.access(user, permissions),
      user: this.publicUser(user, permissions),
    };
  }
  async login(dto: LoginDto, request: Request) {
    const user = await this.db.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { barbershop: { include: { subscription: true } } },
    });
    if (!user || !user.active || !(await bcrypt.compare(dto.password, user.passwordHash)))
      throw new UnauthorizedException('Credenciais inválidas');
    this.assertBarbershopAccess(user.barbershop);
    await this.db.auditLog.create({
      data: {
        userId: user.id,
        barbershopId: user.barbershopId,
        action: 'LOGIN',
        entity: 'SESSION',
        ip: request.ip,
      },
    });
    return this.createSession(user, request);
  }
  async refresh(raw: string | undefined, request: Request) {
    if (!raw) throw new UnauthorizedException('Sessão ausente');
    const session = await this.db.session.findUnique({
      where: { tokenHash: this.hash(raw) },
      include: { user: { include: { barbershop: { include: { subscription: true } } } } },
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.user.active)
      throw new UnauthorizedException('Sessão inválida ou expirada');
    this.assertBarbershopAccess(session.user.barbershop);
    await this.db.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    return this.createSession(session.user, request);
  }
  async logout(raw?: string) {
    if (raw)
      await this.db.session.updateMany({
        where: { tokenHash: this.hash(raw), revokedAt: null },
        data: { revokedAt: new Date() },
      });
  }
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await bcrypt.compare(dto.currentPassword, user.passwordHash)))
      throw new UnauthorizedException('Senha atual inválida');
    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.db.$transaction([
      this.db.user.update({ where: { id: userId }, data: { passwordHash } }),
      this.db.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.db.auditLog.create({
        data: {
          userId,
          barbershopId: user.barbershopId,
          action: 'PASSWORD_CHANGED',
          entity: 'USER',
          entityId: userId,
        },
      }),
    ]);
  }
  async forgotPassword(dto: ForgotPasswordDto, request: Request) {
    const user = await this.db.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user || !user.active) return {};
    const rawToken = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + RESET_MINUTES * 60000);
    await this.db.$transaction([
      this.db.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.db.passwordResetToken.create({
        data: { userId: user.id, tokenHash: this.hash(rawToken), expiresAt },
      }),
      this.db.auditLog.create({
        data: {
          userId: user.id,
          barbershopId: user.barbershopId,
          action: 'PASSWORD_RESET_REQUESTED',
          entity: 'USER',
          entityId: user.id,
          ip: request.ip,
        },
      }),
    ]);
    return process.env.NODE_ENV === 'production' ? {} : { resetToken: rawToken };
  }
  async resetPassword(dto: ResetPasswordDto, request: Request) {
    const reset = await this.db.passwordResetToken.findUnique({
      where: { tokenHash: this.hash(dto.token) },
      include: { user: true },
    });
    if (!reset || reset.usedAt || reset.expiresAt <= new Date() || !reset.user.active)
      throw new UnauthorizedException('Token inválido ou expirado');
    const now = new Date();
    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.db.$transaction([
      this.db.user.update({ where: { id: reset.userId }, data: { passwordHash } }),
      this.db.passwordResetToken.updateMany({
        where: { userId: reset.userId, usedAt: null },
        data: { usedAt: now },
      }),
      this.db.session.updateMany({
        where: { userId: reset.userId, revokedAt: null },
        data: { revokedAt: now },
      }),
      this.db.auditLog.create({
        data: {
          userId: reset.userId,
          barbershopId: reset.user.barbershopId,
          action: 'PASSWORD_RESET_COMPLETED',
          entity: 'USER',
          entityId: reset.userId,
          ip: request.ip,
        },
      }),
    ]);
  }
}

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}
  private setCookie(res: Response, token: string, expires: Date) {
    res.cookie(COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires,
      path: '/api/auth',
    });
  }
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(dto, req);
    this.setCookie(res, result.refreshToken, result.expiresAt);
    return { accessToken: result.accessToken, user: result.user };
  }
  @Post('forgot-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    const development = await this.auth.forgotPassword(dto, req);
    return {
      message: 'Se o e-mail estiver cadastrado, enviaremos as instruções de recuperação.',
      ...development,
    };
  }
  @Post('reset-password')
  @HttpCode(204)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    await this.auth.resetPassword(dto, req);
  }
  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.refresh(req.cookies?.[COOKIE], req);
    this.setCookie(res, result.refreshToken, result.expiresAt);
    return { accessToken: result.accessToken, user: result.user };
  }
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[COOKIE]);
    res.clearCookie(COOKIE, { path: '/api/auth' });
  }
  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }
  @Post('change-password')
  @HttpCode(204)
  @UseGuards(AuthGuard('jwt'))
  async changePassword(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChangePasswordDto) {
    await this.auth.changePassword(user.sub, dto);
  }
}
