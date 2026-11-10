const jwt = require('jsonwebtoken');

const getTokenMaxAge = () => {
  const duration = process.env.JWT_EXPIRES_IN || '7d';
  const match = /^([1-9]\d*)(s|m|h|d)$/.exec(duration);
  if (!match) {
    throw new Error('JWT_EXPIRES_IN must be a positive duration such as 15m or 7d');
  }

  const unitSeconds = { s: 1, m: 60, h: 3600, d: 86400 };
  return Number(match[1]) * unitSeconds[match[2]] * 1000;
};

const generateToken = (id) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET must be configured');
  }

  getTokenMaxAge();
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

generateToken.getTokenMaxAge = getTokenMaxAge;

module.exports = generateToken;