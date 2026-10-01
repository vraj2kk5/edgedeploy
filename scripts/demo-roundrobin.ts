import { config } from '@edgedeploy/shared';

async function runDemo() {
  console.log('----------------------------------------------------');
  console.log('🔥 DEMO: GATEWAY ROUND-ROBIN LOAD BALANCING');
  console.log('Sending 6 consecutive visitor requests to Gateway (:8080)...');
  console.log('----------------------------------------------------');

  const gatewayUrl = `http://127.0.0.1:${config.ports.gateway}/serve/1/index.html`;

  for (let i = 1; i <= 6; i++) {
    try {
      const res = await fetch(gatewayUrl);
      const edgeNode = res.headers.get('x-edge-node') || 'Unknown';
      const cacheStatus = res.headers.get('x-cache') || 'NONE';
      console.log(`Request #${i} -> Served by Node: [${edgeNode}] | Status: ${res.status} | Cache: ${cacheStatus}`);
    } catch (err: any) {
      console.error(`Request #${i} Failed:`, err.message);
    }
  }

  console.log('----------------------------------------------------');
  console.log('✅ Round Robin Demonstration Finished!');
}

runDemo();
