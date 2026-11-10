const crypto = require('crypto');
const request = require('supertest');
const app = require('../app');
const User = require('../models/User');

const validUser = {
  username: 'test_user',
  email: 'person@example.com',
  password: 'Strong!Horse42',
};

const register = (overrides = {}) =>
  request(app).post('/api/auth/register').send({ ...validUser, ...overrides });

describe('authentication', () => {
  test('allows the configured local origin and its loopback alias in development', async () => {
    const localhost = await request(app)
      .get('/api/auth/me')
      .set('Origin', 'http://localhost:5173');
    const loopback = await request(app)
      .get('/api/auth/me')
      .set('Origin', 'http://127.0.0.1:5173');

    expect(localhost.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(loopback.headers['access-control-allow-origin']).toBe('http://127.0.0.1:5173');
    expect(loopback.status).toBe(401);
  });

  test('registers a user, hashes the password, and sets an httpOnly cookie', async () => {
    const response = await register();

    expect(response.status).toBe(201);
    expect(response.body.user).toMatchObject({
      username: validUser.username,
      email: validUser.email,
    });
    expect(response.body.user.password).toBeUndefined();
    expect(response.headers['set-cookie'][0]).toMatch(/HttpOnly/i);
    expect(response.headers['set-cookie'][0]).toMatch(/SameSite=Lax/i);

    const user = await User.findOne({ email: validUser.email }).select('+password');
    expect(user.password).not.toBe(validUser.password);
    expect(user.password.startsWith('$2')).toBe(true);
    expect(await user.matchPassword(validUser.password)).toBe(true);
  });

  test('rejects duplicate email case-insensitively', async () => {
    await register();
    const response = await register({ username: 'another_user', email: 'PERSON@EXAMPLE.COM' });

    expect(response.status).toBe(409);
    expect(response.body.errors.email).toMatch(/already registered/i);
  });

  test('rejects duplicate username case-insensitively', async () => {
    await register();
    const response = await register({ username: 'TEST_USER', email: 'other@example.com' });

    expect(response.status).toBe(409);
    expect(response.body.errors.username).toMatch(/already taken/i);
  });

  test.each([
    ['numeric password', '123456789'],
    ['common password', 'password123'],
    ['password similar to username', 'test_user!23'],
    ['short password', 'abc123'],
  ])('rejects a %s', async (_label, password) => {
    const response = await register({ password });

    expect(response.status).toBe(400);
    expect(response.body.errors.password).toBeTruthy();
  });

  test('logs in with a case-insensitive username or email', async () => {
    await register();

    const usernameLogin = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'TEST_USER', password: validUser.password });
    const emailLogin = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'PERSON@EXAMPLE.COM', password: validUser.password });

    expect(usernameLogin.status).toBe(200);
    expect(emailLogin.status).toBe(200);
    expect(emailLogin.body.user.email).toBe(validUser.email);
  });

  test('uses the same generic error for an incorrect password', async () => {
    await register();
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ identifier: validUser.email, password: 'incorrect-password' });
    const unknownUser = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'unknown@example.com', password: 'incorrect-password' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(wrongPassword.body.message).toBe('Invalid credentials');
    expect(wrongPassword.body).toEqual(unknownUser.body);
  });

  test('blocks anonymous requests and returns the signed-in user from /me', async () => {
    await register();
    const anonymous = await request(app).get('/api/auth/me');
    const privateRoute = await request(app).get('/api/projects');
    const login = await request(app)
      .post('/api/auth/login')
      .send({ identifier: validUser.email, password: validUser.password });
    const cookie = login.headers['set-cookie'][0].split(';')[0];
    const authenticated = await request(app).get('/api/auth/me').set('Cookie', cookie);

    expect(anonymous.status).toBe(401);
    expect(privateRoute.status).toBe(401);
    expect(authenticated.status).toBe(200);
    expect(authenticated.body.user.password).toBeUndefined();
  });

  test('logout clears the authentication cookie', async () => {
    const response = await request(app).post('/api/auth/logout');

    expect(response.status).toBe(200);
    expect(response.headers['set-cookie'][0]).toMatch(/token=;/);
    expect(response.headers['set-cookie'][0]).toMatch(/Expires=/i);
  });

  test('forgot-password has the same response for known and unknown emails', async () => {
    await register();
    const emailLog = jest.spyOn(console, 'info').mockImplementation(() => {});
    const known = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: validUser.email });
    const unknown = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'missing@example.com' });

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body).toEqual(unknown.body);

    const resetUrl = emailLog.mock.calls[0][0];
    const rawToken = resetUrl.match(/reset-password\/([a-f0-9]{64})$/)[1];
    const user = await User.findOne({ email: validUser.email })
      .select('+passwordResetToken +passwordResetExpires');
    expect(user.passwordResetToken).toMatch(/^[a-f0-9]{64}$/);
    expect(user.passwordResetToken).toBe(
      crypto.createHash('sha256').update(rawToken).digest('hex')
    );
    expect(user.passwordResetExpires.getTime()).toBeGreaterThan(Date.now());
    emailLog.mockRestore();
  });

  test('forgot-password stays generic when reset email delivery fails', async () => {
    await register();
    const previousEnv = {
      NODE_ENV: process.env.NODE_ENV,
      SMTP_HOST: process.env.SMTP_HOST,
      SMTP_PORT: process.env.SMTP_PORT,
      EMAIL_FROM: process.env.EMAIL_FROM,
    };
    process.env.NODE_ENV = 'production';
    process.env.SMTP_HOST = '';
    process.env.SMTP_PORT = '';
    process.env.EMAIL_FROM = '';
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const known = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: validUser.email });
      const unknown = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'missing@example.com' });

      expect(known.status).toBe(200);
      expect(unknown.status).toBe(200);
      expect(known.body).toEqual(unknown.body);
      expect(errorLog).toHaveBeenCalledTimes(1);
    } finally {
      Object.entries(previousEnv).forEach(([name, value]) => {
        if (value === undefined) {
          delete process.env[name];
        } else {
          process.env[name] = value;
        }
      });
      errorLog.mockRestore();
    }
  });

  test('reset token works only once and expired tokens are rejected', async () => {
    await register();
    const token = crypto.randomBytes(32).toString('hex');
    const user = await User.findOne({ email: validUser.email });
    user.passwordResetToken = crypto.createHash('sha256').update(token).digest('hex');
    user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    const firstReset = await request(app)
      .post(`/api/auth/reset-password/${token}`)
      .send({ password: 'New!StrongPass456' });
    const secondReset = await request(app)
      .post(`/api/auth/reset-password/${token}`)
      .send({ password: 'Another!StrongPass789' });

    expect(firstReset.status).toBe(200);
    expect(secondReset.status).toBe(400);

    const expiredToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto.createHash('sha256').update(expiredToken).digest('hex');
    user.passwordResetExpires = new Date(Date.now() - 1000);
    await user.save();
    const expiredReset = await request(app)
      .post(`/api/auth/reset-password/${expiredToken}`)
      .send({ password: 'Another!StrongPass789' });

    expect(expiredReset.status).toBe(400);
  });
});
