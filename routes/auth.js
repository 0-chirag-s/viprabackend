import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { User, Organization } from '../models/index.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Employee Login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty().trim(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({
      where: { email, is_active: true },
      include: [{
        model: Organization,
        as: 'organization',
        attributes: ['org_name', 'subscription_plan', 'is_active']
      }]
    });

    if (!user || !user.organization.is_active) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials or inactive account' 
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // Update last login
    await user.update({ last_login: new Date() });

    // Generate JWT
    const token = jwt.sign(
      { 
        user_id: user.user_id, 
        organization_id: user.organization_id,
        role: user.role,
        type: 'employee'
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          user_id: user.user_id,
          name: `${user.first_name} ${user.last_name}`,
          email: user.email,
          role: user.role,
          department: user.department,
          organization: user.organization.org_name,
          password_reset_required: user.password_reset_required
        }
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Organization Login
router.post('/organization/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty().trim(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { email, password } = req.body;

    // Find organization
    const organization = await Organization.findOne({
      where: { admin_email: email, is_active: true }
    });

    if (!organization) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, organization.admin_password);
    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // Generate JWT
    const token = jwt.sign(
      { 
        organization_id: organization.organization_id,
        type: 'organization'
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      message: 'Organization login successful',
      data: {
        token,
        organization: {
          organization_id: organization.organization_id,
          org_name: organization.org_name,
          subscription_plan: organization.subscription_plan,
          admin_email: organization.admin_email
        }
      }
    });

  } catch (error) {
    console.error('Organization login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Reset Password
router.post('/reset-password', authenticateToken, [
  body('current_password').notEmpty().trim(),
  body('new_password').isLength({ min: 6 }).trim(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { current_password, new_password } = req.body;
    const user = req.user;

    // Verify current password
    const isValidPassword = await bcrypt.compare(current_password, user.password_hash);
    if (!isValidPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Current password is incorrect' 
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(new_password, 10);

    // Update password
    await user.update({ 
      password_hash: hashedPassword,
      password_reset_required: false
    });

    res.json({
      success: true,
      message: 'Password updated successfully'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

export default router;
