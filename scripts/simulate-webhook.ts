import crypto from 'crypto';
import { config, queryOne } from '@edgedeploy/shared';

async function runDemo() {
  console.log('----------------------------------------------------');
  console.log('📦 DEMO: SIMULATE GITHUB WEBHOOK PUSH PAYLOAD');
  console.log('----------------------------------------------------');

  const repo = await queryOne<any>('SELECT * FROM Repositories WHERE project_id = 1');
  if (!repo) {
    console.error('No repository found for project 1');
    return;
  }

  const payload = {
    ref: 'refs/heads/main',
    before: '0000000000000000000000000000000000000000',
    after: crypto.randomBytes(20).toString('hex'),
    repository: {
      name: repo.name,
      owner: {
        name: repo.owner,
      },
    },
    head_commit: {
      id: crypto.randomBytes(20).toString('hex'),
      message: 'Automated CI/CD Push Triggered via simulate-webhook.ts',
      timestamp: new Date().toISOString(),
    },
  };

  const rawBody = JSON.stringify(payload);
  const secret = repo.webhook_secret || 'secret_seed_456';
  const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  const webhookUrl = `http://127.0.0.1:${config.ports.backend}/api/webhooks/github`;

  console.log(`Sending signed push payload to ${webhookUrl}...`);
  console.log(`Signature: ${signature}`);

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-github-event': 'push',
        'x-hub-signature-256': signature,
      },
      body: rawBody,
    });

    const data = await res.json();
    console.log(`Response Status: ${res.status}`);
    console.log('Response Body:', data);
    console.log('----------------------------------------------------');
    console.log('✅ Webhook simulation complete!');
  } catch (err: any) {
    console.error('Webhook simulation failed:', err.message);
  }
}

runDemo();
