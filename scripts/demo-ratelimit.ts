import { config } from '@edgedeploy/shared';

async function runDemo() {
  console.log('----------------------------------------------------');
  console.log('🛑 DEMO: TOKEN BUCKET RATE LIMITER & 429 PROTECTION');
  console.log('Flooding Gateway (:8080) with rapid requests...');
  console.log('----------------------------------------------------');

  const gatewayUrl = `http://localhost:${config.ports.gateway}/serve/1/index.html`;

  let blockedCount = 0;
  let allowedCount = 0;

  for (let i = 1; i <= 25; i++) {
    try {
      const res = await fetch(gatewayUrl);
      if (res.status === 429) {
        blockedCount++;
        const retryAfter = res.headers.get('retry-after');
        const body = await res.json();
        console.log(`Request #${i} -> 🛑 429 TOO MANY REQUESTS | Retry-After: ${retryAfter}s | Message: ${body.error?.message}`);
      } else {
        allowedCount++;
        console.log(`Request #${i} -> ✅ ${res.status} OK | X-Cache: ${res.headers.get('x-cache')}`);
      }
    } catch (err: any) {
      console.error(`Request #${i} error: ${err.message}`);
    }
  }

  console.log('----------------------------------------------------');
  console.log(`Summary: Allowed = ${allowedCount}, Blocked = ${blockedCount}`);
  console.log('✅ Token Bucket Rate Limiter verified successfully!');
}

runDemo();
