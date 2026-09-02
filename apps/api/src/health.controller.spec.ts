import { HealthController } from './health.controller';
describe('HealthController', () => {
  it('confirma que aplicação e banco estão disponíveis', async () => {
    const db = { $queryRaw: jest.fn().mockResolvedValue([{ value: 1 }]) };
    const result = await new HealthController(db as never).check();
    expect(result.status).toBe('ok');
    expect(result.database).toBe('connected');
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
