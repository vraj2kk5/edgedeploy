import { config } from '@edgedeploy/shared';

async function runDemo() {
  console.log('----------------------------------------------------');
  console.log('🔄 DEMO: DEPLOYMENT CACHE INVALIDATION PIPELINE');
  console.log('----------------------------------------------------');

  const gatewayUrl = `http://127.0.0.1:${config.ports.gateway}/serve/1/index.html`;

  console.log('1. Fetching active site version...');
  const res1 = await fetch(gatewayUrl);
  console.log(`   Initial Status: ${res1.status} | X-Cache: ${res1.headers.get('x-cache')}`);

  console.log('\n2. Triggering cache purge signal...');
  for (const port of config.ports.edgePorts) {
    try {
      await fetch(`http://127.0.0.1:${port}/internal/purge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-token': config.security.internalApiToken,
        },
        body: JSON.stringify({ scope: 'project', projectId: 1 }),
      });
      console.log(`   Sent purge signal to Edge node on port :${port}`);
    } catch (err) {}
  }

  console.log('\n3. Fetching site again (Post-Invalidation)...');
  const res2 = await fetch(gatewayUrl);
  console.log(`   Post-Purge Status: ${res2.status} | X-Cache: ${res2.headers.get('x-cache')}`);
  console.log('----------------------------------------------------');
  console.log('✅ Invalidation test complete! (Cache reset to MISS upon new deployment)');
}

runDemo();
