import { execute } from '@edgedeploy/shared';

async function updateDb() {
  console.log('Updating DB schema for Pull Request Previews...');
  try {
    await execute('ALTER TABLE Deployments ADD COLUMN pr_number INT NULL AFTER branch').catch((e) => {
      console.log('pr_number column notice:', e.message);
    });
    await execute("ALTER TABLE Deployments MODIFY COLUMN `trigger` ENUM('WEBHOOK', 'MANUAL', 'REDEPLOY', 'PULL_REQUEST') NOT NULL DEFAULT 'MANUAL'");
    console.log('✅ DB Schema updated successfully!');
  } catch (err: any) {
    console.error('❌ Schema update error:', err.message);
  }
}

updateDb();
