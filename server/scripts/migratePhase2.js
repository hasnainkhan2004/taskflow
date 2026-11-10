require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const dns = require('node:dns');
if (process.env.DNS_SERVERS) {
  dns.setServers(process.env.DNS_SERVERS.split(',').map((server) => server.trim()).filter(Boolean));
}

const mongoose = require('mongoose');
const migratePhase2 = require('../utils/phase2Migration');

const run = async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI must be configured');
  const dryRun = process.argv.includes('--dry-run');
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  const stats = await migratePhase2({ dryRun });
  console.log(`${dryRun ? 'Phase 2 migration dry run' : 'Phase 2 migration completed'}: ${JSON.stringify(stats)}`);
};

run()
  .catch((error) => {
    console.error(`Phase 2 migration failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => mongoose.disconnect());
