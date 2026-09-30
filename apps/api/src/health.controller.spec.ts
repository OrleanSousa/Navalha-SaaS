import { HealthController } from './health.controller';
describe('HealthController', () => {
  it('confirma que aplicação e banco estão disponíveis', async () => {
    const db = { $queryRaw: jest.fn().mockResolvedValue([{ value: 1 }]) };
    const monitoring = { status: jest.fn().mockReturnValue('disabled') };
    const result = await new HealthController(db as never, monitoring as never).check();
    expect(result.status).toBe('ok');
    expect(result.database).toBe('connected');
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('responde liveness sem depender do banco', () => {
    const controller = new HealthController({} as never, {} as never);
    expect(controller.liveness().status).toBe('ok');
  });
});
