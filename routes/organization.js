import express from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { Organization } from '../models/index.js';
import multer from 'multer';
import path from 'path';
import { authenticateOrganization } from '../middleware/auth.js';
import excelService from '../services/excelService.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.xlsx', '.xls'];
    const fileExt = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(fileExt)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files are allowed'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Organization Registration
router.post('/register', [
  body('org_name').notEmpty().trim().isLength({ min: 2, max: 255 }),
  body('admin_email').isEmail().normalizeEmail(),
  body('admin_password').isLength({ min: 6 }),
  body('subscription_plan').isIn(['starter', 'pro', 'enterprise']),
  body('contact_phone').optional().isMobilePhone(),
  body('address').optional().trim()
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

    const { org_name, admin_email, admin_password, subscription_plan, contact_phone, address } = req.body;

    // Check if organization already exists
    const existingOrg = await Organization.findOne({
      where: { admin_email }
    });

    if (existingOrg) {
      return res.status(400).json({ 
        success: false, 
        message: 'Organization with this email already exists' 
      });
    }

    // Generate unique organization ID
    const organizationId = `ORG_${Date.now()}`;

    // Hash admin password
    const hashedPassword = await bcrypt.hash(admin_password, 10);

    // Determine max users based on plan
    const maxUsers = {
      'starter': 50,
      'pro': 500,
      'enterprise': 5000
    }[subscription_plan] || 50;

    // Create organization
    const organization = await Organization.create({
      organization_id: organizationId,
      org_name,
      subscription_plan,
      max_users: maxUsers,
      admin_email,
      admin_password: hashedPassword,
      contact_phone,
      address
    });

    res.status(201).json({
      success: true,
      message: 'Organization registered successfully',
      data: {
        organization_id: organization.organization_id,
        org_name: organization.org_name,
        subscription_plan: organization.subscription_plan,
        max_users: organization.max_users,
        admin_email: organization.admin_email
      }
    });

  } catch (error) {
    console.error('Organization registration error:', error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ 
        success: false, 
        message: 'Organization with this email already exists' 
      });
    }
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Upload and Process Employee Excel
router.post('/upload-employees', authenticateOrganization, upload.single('excelFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'Excel file is required' 
      });
    }

    const organization = req.organization;
    
    // Process Excel file
    const result = await excelService.processEmployeeExcel(
      req.file.path, 
      organization.organization_id
    );

    // Clean up uploaded file
    const fs = await import('fs');
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      message: result.message,
      data: {
        processed_employees: result.data.length,
        employees: result.data
      }
    });

  } catch (error) {
    console.error('Excel upload error:', error);
    
    // Clean up uploaded file on error
    if (req.file) {
      try {
        const fs = await import('fs');
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error('File cleanup error:', cleanupError);
      }
    }

    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to process Excel file' 
    });
  }
});

// Get Organization Statistics
router.get('/statistics', authenticateOrganization, async (req, res) => {
  try {
    const { User, ChatLog } = await import('../models/index.js');
    const organization = req.organization;

    // Get employee statistics
    const totalEmployees = await User.count({
      where: { organization_id: organization.organization_id, is_active: true }
    });

    const employeesByDepartment = await User.findAll({
      where: { organization_id: organization.organization_id, is_active: true },
      attributes: [
        'department',
        [sequelize.fn('COUNT', sequelize.col('department')), 'count']
      ],
      group: ['department'],
      raw: true
    });

    // Get chat statistics
    const totalChatQueries = await ChatLog.count({
      where: { organization_id: organization.organization_id }
    });

    const chatQueriesThisMonth = await ChatLog.count({
      where: {
        organization_id: organization.organization_id,
        createdAt: {
          [Op.gte]: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        }
      }
    });

    // Most common intents
    const topIntents = await ChatLog.findAll({
      where: { organization_id: organization.organization_id },
      attributes: [
        'intent',
        [sequelize.fn('COUNT', sequelize.col('intent')), 'count']
      ],
      group: ['intent'],
      order: [[sequelize.fn('COUNT', sequelize.col('intent')), 'DESC']],
      limit: 5,
      raw: true
    });

    res.json({
      success: true,
      message: 'Statistics retrieved successfully',
      data: {
        organization: {
          name: organization.org_name,
          plan: organization.subscription_plan,
          max_users: organization.max_users
        },
        employees: {
          total: totalEmployees,
          usage_percentage: ((totalEmployees / organization.max_users) * 100).toFixed(1),
          by_department: employeesByDepartment
        },
        chat_analytics: {
          total_queries: totalChatQueries,
          queries_this_month: chatQueriesThisMonth,
          top_intents: topIntents
        }
      }
    });

  } catch (error) {
    console.error('Statistics error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Add New Employee Manually
router.post('/add-employee', authenticateOrganization, [
  body('first_name').notEmpty().trim(),
  body('last_name').notEmpty().trim(),
  body('email').isEmail().normalizeEmail(),
  body('role').isIn(['Employee', 'Manager', 'Admin']),
  body('department').notEmpty().trim(),
  body('location').notEmpty().trim(),
  body('date_of_joining').isDate(),
  body('date_of_birth').isDate(),
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

    const organization = req.organization;
    const { first_name, last_name, email, role, department, location, date_of_joining, date_of_birth, manager_id } = req.body;

    // Check user limit
    const currentUserCount = await User.count({
      where: { organization_id: organization.organization_id, is_active: true }
    });

    if (currentUserCount >= organization.max_users) {
      return res.status(400).json({ 
        success: false, 
        message: `User limit exceeded. Your ${organization.subscription_plan} plan allows maximum ${organization.max_users} users.` 
      });
    }

    // Generate unique user ID
    const userId = `${organization.organization_id}_${Date.now()}`;

    // Default password is date of birth
    const defaultPassword = date_of_birth.replace(/-/g, '');
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    // Create user
    const user = await User.create({
      user_id: userId,
      organization_id: organization.organization_id,
      first_name,
      last_name,
      email,
      password_hash: hashedPassword,
      role,
      manager_id,
      date_of_joining,
      date_of_birth,
      department,
      location,
      password_reset_required: true
    });

    res.status(201).json({
      success: true,
      message: 'Employee added successfully',
      data: {
        user_id: user.user_id,
        name: `${user.first_name} ${user.last_name}`,
        email: user.email,
        default_password: defaultPassword
      }
    });

  } catch (error) {
    console.error('Add employee error:', error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ 
        success: false, 
        message: 'Employee with this email already exists' 
      });
    }
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

export default router;
