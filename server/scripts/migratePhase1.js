require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const dns = require('node:dns');
if (process.env.DNS_SERVERS) {
  dns.setServers(process.env.DNS_SERVERS.split(',').map((server) => server.trim()).filter(Boolean));
}

const mongoose = require('mongoose');
const migratePhase1 = require('../utils/phase1Migration');

const run = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI must be configured');
  }

  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  await migratePhase1();
  console.log('Phase 1 migration completed.');
};

run()
  .catch((error) => {
    console.error(`Phase 1 migration failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
