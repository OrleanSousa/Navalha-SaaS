const base = (process.env.SMOKE_BASE_URL || 'http://localhost:3333').replace(/\/$/, '');
const web = (process.env.SMOKE_WEB_URL || 'http://localhost:5173').replace(/\/$/, '');

async function assertResponse(url, predicate) {
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`${url} respondeu HTTP ${response.status}`);
  const body = await response.text();
  if (!predicate(body)) throw new Error(`${url} respondeu conteúdo inesperado`);
  console.log(`OK ${url}`);
}

await assertResponse(`${base}/api/health/live`, (body) => JSON.parse(body).status === 'ok');
await assertResponse(
  `${base}/api/health/ready`,
  (body) => JSON.parse(body).database === 'connected',
);
await assertResponse(web, (body) => /<div id="root"><\/div>/.test(body));
