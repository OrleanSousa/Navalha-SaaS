const base = (process.env.LOAD_BASE_URL || 'http://localhost:3333/api').replace(/\/$/, '');
const slug = process.env.LOAD_SHOP_SLUG;
const requests = Number(process.env.LOAD_REQUESTS || 200);
const concurrency = Number(process.env.LOAD_CONCURRENCY || 20);
if (!slug) throw new Error('Defina LOAD_SHOP_SLUG para executar o teste de carga');

const latencies = [];
let failures = 0;
let cursor = 0;
async function worker() {
  while (cursor < requests) {
    cursor += 1;
    const started = performance.now();
    try {
      const response = await fetch(`${base}/public/${encodeURIComponent(slug)}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) failures += 1;
    } catch {
      failures += 1;
    } finally {
      latencies.push(performance.now() - started);
    }
  }
}
await Promise.all(Array.from({ length: concurrency }, worker));
latencies.sort((a, b) => a - b);
const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
console.log(JSON.stringify({ requests, concurrency, failures, p95Ms: Math.round(p95) }));
if (failures / requests > 0.01 || p95 > 1500) process.exitCode = 1;
