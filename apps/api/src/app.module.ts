import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaService } from './prisma.service';
import { AuthController, AuthService, JwtStrategy } from './auth';
import { DataController } from './data.controller';
import { HealthController } from './health.controller';
import { TenantContext } from './auth-context';
import { DataService } from './data.service';
import { AvailabilityService } from './availability.service';
import { PermissionsGuard, RolesGuard } from './rbac';
import { SuperAdminController, SuperAdminService } from './super-admin';
import { PublicBookingController } from './public-booking.controller';
import { PublicBookingService } from './public-booking.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { LocalMessageProvider, MESSAGE_PROVIDER } from './message-provider';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    PassportModule,
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'development-secret-change-me',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [
    AuthController,
    DataController,
    HealthController,
    SuperAdminController,
    PublicBookingController,
    NotificationsController,
  ],
  providers: [
    PrismaService,
    AuthService,
    JwtStrategy,
    TenantContext,
    DataService,
    AvailabilityService,
    RolesGuard,
    PermissionsGuard,
    SuperAdminService,
    PublicBookingService,
    NotificationsService,
    { provide: MESSAGE_PROVIDER, useClass: LocalMessageProvider },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
