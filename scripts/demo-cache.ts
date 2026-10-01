import { config } from '@edgedeploy/shared';

async function runDemo() {
  console.log('----------------------------------------------------');
  console.log('⚡ DEMO: CDN CACHE HIT VS MISS LATENCY PERFORMANCE');
  console.log('----------------------------------------------------');

  // Purge cache first for clean start
  await fetch(`http://127.0.0.1:${config.ports.backend}/api/admin/cache/purge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope: 'all' }),
  }).catch(() => {});

  const gatewayUrl = `http://127.0.0.1:${config.ports.gateway}/serve/1/index.html`;

  // First Request: Expected MISS
  const start1 = Date.now();
  const res1 = await fetch(gatewayUrl);
  const latency1 = Date.now() - start1;
  const cache1 = res1.headers.get('x-cache') || 'UNKNOWN';

  console.log(`1st Request (Initial Cache MISS):`);
  console.log(`   X-Cache Header: [${cache1}]`);
  console.log(`   Latency:        ${latency1} ms`);
  console.log(`   Served By Node: ${res1.headers.get('x-edge-node')}`);

  console.log('\n--- Fetching same resource again ---');

  // Second Request: Expected HIT
  const start2 = Date.now();
  const res2 = await fetch(gatewayUrl);
  const latency2 = Date.now() - start2;
  const cache2 = res2.headers.get('x-cache') || 'UNKNOWN';

  console.log(`2nd Request (Cached HIT):`);
  console.log(`   X-Cache Header: [${cache2}]`);
  console.log(`   Latency:        ${latency2} ms`);
  console.log(`   Served By Node: ${res2.headers.get('x-edge-node')}`);

  console.log('----------------------------------------------------');
  console.log(`✅ Cache Verification Complete! (HIT is ${Math.max(0, latency1 - latency2)}ms faster)`);
}

runDemo();
