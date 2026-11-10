const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const { getPasswordErrors } = require('../utils/passwordRules');
const { sendPasswordResetEmail } = require('../utils/email');
const Workspace = require('../models/Workspace');
const Membership = require('../models/Membership');
const { loadMemberships } = require('../utils/permissions');

const dummyPasswordHash = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 12);

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

const setAuthCookie = (res, userId) => {
  const token = generateToken(userId);
  res.cookie('token', token, {
    ...cookieOptions(),
    maxAge: generateToken.getTokenMaxAge(),
  });
};

const publicUser = (user) => ({
  _id: user._id,
  username: user.username,
  email: user.email,
  createdAt: user.createdAt,
});

const registerUser = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    const duplicateEmail = await User.exists({ email });
    if (duplicateEmail) {
      return res.status(409).json({
        message: 'An account already uses this email.',
        errors: { email: 'This email is already registered' },
      });
    }

    const duplicateUsername = await User.exists({ username });
    if (duplicateUsername) {
      return res.status(409).json({
        message: 'That username is already taken.',
        errors: { username: 'This username is already taken' },
      });
    }

    const user = await User.create({ username, email, password });
    const workspace = await Workspace.create({
      name: `${user.username}'s Workspace`,
      slug: `${user.username}-workspace`,
      owner: user._id,
      createdBy: user._id,
      isPersonal: true,
    });
    await Membership.create({ workspace: workspace._id, user: user._id, role: 'owner' });
    setAuthCookie(res, user._id);
    return res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];
      if (field === 'username' || field === 'email') {
        return res.status(409).json({
          message: field === 'email'
            ? 'An account already uses this email.'
            : 'That username is already taken.',
          errors: {
            [field]: field === 'email'
              ? 'This email is already registered'
              : 'This username is already taken',
          },
        });
      }
    }
    return next(error);
  }
};

const loginUser = async (req, res, next) => {
  try {
    const { identifier, password } = req.body;
    const normalizedIdentifier = identifier.trim().toLowerCase();
    const user = await User.findOne({
      $or: [
        { username: normalizedIdentifier },
        { email: normalizedIdentifier },
      ],
    }).select('+password');

    const passwordMatches = user
      ? await user.matchPassword(password)
      : await bcrypt.compare(password, dummyPasswordHash);
    if (!user || !passwordMatches) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    setAuthCookie(res, user._id);
    return res.json({ user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
};

const logoutUser = (req, res) => {
  const options = cookieOptions();
  delete options.maxAge;
  res.clearCookie('token', options);
  res.json({ message: 'Logged out successfully' });
};

const getMe = async (req, res, next) => {
  try {
    const memberships = await loadMemberships(req.user._id);
    res.json({
      user: {
        ...publicUser(req.user),
        workspaces: memberships.map(({ workspace, role }) => ({
          ...workspace,
          personal: workspace.isPersonal ?? workspace.personal ?? false,
          role,
        })),
      },
    });
  } catch (error) {
    return next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      user.passwordResetToken = crypto.createHash('sha256').update(token).digest('hex');
      user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);
      await user.save();

      if (!process.env.CLIENT_URL) {
        throw new Error('CLIENT_URL must be configured');
      }
      const clientUrl = process.env.CLIENT_URL.replace(/\/$/, '');
      try {
        await sendPasswordResetEmail(user.email, `${clientUrl}/reset-password/${token}`);
      } catch (emailError) {
        console.error(`Password reset email delivery failed: ${emailError.message}`);
      }
    }

    return res.json({
      message: 'If an account exists for that email, a password reset link has been sent.',
    });
  } catch (error) {
    return next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({
      passwordResetToken: tokenHash,
      passwordResetExpires: { $gt: new Date() },
    }).select('+passwordResetToken +passwordResetExpires +password');

    if (!user) {
      return res.status(400).json({
        message: 'Reset link is invalid or expired.',
        errors: { password: 'Reset link is invalid or expired' },
      });
    }

    const passwordErrors = getPasswordErrors(
      req.body.password,
      user.username,
      user.email
    );
    if (passwordErrors.length) {
      return res.status(400).json({
        message: 'Please check the highlighted fields.',
        errors: { password: passwordErrors[0] },
      });
    }

    user.password = req.body.password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    return res.json({ message: 'Password has been reset. You can now sign in.' });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  getMe,
  forgotPassword,
  resetPassword,
};
