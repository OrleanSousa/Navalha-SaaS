import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ErrorMonitoringService } from './observability';
@Controller('health')
export class HealthController {
  constructor(
    private readonly db: PrismaService,
    private readonly monitoring: ErrorMonitoringService,
  ) {}
  @Get()
  live() {
    return {
      status: 'ok',
      uptimeSeconds: Math.floor(process.uptime()),
      version: process.env.APP_VERSION || 'development',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('live')
  liveness() {
    return this.live();
  }

  @Get('ready')
  async check() {
    await this.db.$queryRaw`SELECT 1`;
    return {
      status: 'ok',
      database: 'connected',
      monitoring: this.monitoring.status(),
      timestamp: new Date().toISOString(),
    };
  }
}
