import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma.service';
@Controller('health')
export class HealthController {
  constructor(private readonly db: PrismaService) {}
  @Get()
  async check() {
    await this.db.$queryRaw`SELECT 1`;
    return { status: 'ok', database: 'connected', timestamp: new Date().toISOString() };
  }
}
