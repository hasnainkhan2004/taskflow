require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const dns = require('node:dns');
if (process.env.DNS_SERVERS) {
  const dnsServers = process.env.DNS_SERVERS.split(',').map((server) => server.trim()).filter(Boolean);
  dns.setServers(dnsServers);
}

const app = require('./app');
const connectDB = require('./config/db');

const start = async () => {
  const required = ['MONGO_URI', 'JWT_SECRET', 'CLIENT_URL'];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  if (process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }
  if (process.env.NODE_ENV === 'production') {
    const missingSmtp = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM']
      .filter((name) => !process.env[name]);
    if (missingSmtp.length) {
      throw new Error(`Missing production email settings: ${missingSmtp.join(', ')}`);
    }
    const smtpPort = Number(process.env.SMTP_PORT);
    if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
      throw new Error('SMTP_PORT must be a valid port number');
    }
  }

  new URL(process.env.CLIENT_URL);
  await connectDB();
  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log(`Server running on port ${port}`));
};

start().catch((error) => {
  console.error(`Server failed to start: ${error.message}`);
  process.exit(1);
});
