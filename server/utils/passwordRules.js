const commonPasswords = new Set([
  'password',
  'password1',
  'password123',
  'password!',
  'qwerty123',
  'qwertyuiop',
  '12345678',
  '123456789',
  'abc12345',
  'iloveyou',
  'monkey123',
  'welcome1',
  'letmein123',
  'welcome123',
  'changeme',
  'passw0rd',
  'admin123',
]);

const getPasswordErrors = (password, username = '', email = '') => {
  const errors = [];
  const normalizedPassword = password.toLowerCase();

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (/^\d+$/.test(password)) {
    errors.push('Password cannot contain only numbers');
  }
  if (commonPasswords.has(normalizedPassword)) {
    errors.push('Choose a less common password');
  }

  const emailName = email.split('@')[0];
  const identityParts = [username, emailName]
    .flatMap((part) => part.trim().toLowerCase().split(/[^a-z0-9]+/))
    .filter((part) => part.length >= 3);
  if (identityParts.some((part) => normalizedPassword.includes(part))) {
    errors.push('Password must not contain your username or email');
  }

  return errors;
};

module.exports = { getPasswordErrors };
