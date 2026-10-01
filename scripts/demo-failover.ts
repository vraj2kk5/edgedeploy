import { config, queryOne, execute } from '@edgedeploy/shared';

async function runDemo() {
  console.log('----------------------------------------------------');
  console.log('🛡️ DEMO: EDGE NODE HEALTH FAILURE & FAILOVER');
  console.log('----------------------------------------------------');

  const gatewayUrl = `http://127.0.0.1:${config.ports.gateway}/serve/1/index.html`;

  console.log('1. Normal Traffic before failure:');
  for (let i = 1; i <= 3; i++) {
    const res = await fetch(gatewayUrl);
    console.log(`   Req #${i} -> Served by Node: [${res.headers.get('x-edge-node')}]`);
  }

  console.log('\n2. Simulating failure on edge-2 (Marking UNHEALTHY in DB)...');
  await execute('UPDATE EdgeNodes SET status = "UNHEALTHY" WHERE name = "edge-2"');

  console.log('\n3. Traffic after edge-2 marked UNHEALTHY (Gateway routes only to healthy edges):');
  for (let i = 1; i <= 4; i++) {
    const res = await fetch(gatewayUrl);
    console.log(`   Req #${i} -> Served by Node: [${res.headers.get('x-edge-node')}]`);
  }

  console.log('\n4. Restoring edge-2 to HEALTHY...');
  await execute('UPDATE EdgeNodes SET status = "HEALTHY" WHERE name = "edge-2"');

  console.log('\n5. Traffic after edge-2 restored:');
  for (let i = 1; i <= 3; i++) {
    const res = await fetch(gatewayUrl);
    console.log(`   Req #${i} -> Served by Node: [${res.headers.get('x-edge-node')}]`);
  }

  console.log('----------------------------------------------------');
  console.log('✅ Failover & Recovery demonstration complete!');
}

runDemo();
