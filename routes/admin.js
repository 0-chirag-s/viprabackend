import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateOrganization } from '../middleware/auth.js';
import { User, Organization, CompanyPolicy, PayrollData } from '../models/index.js';

const router = express.Router();

// Get All Employees
router.get('/employees', authenticateOrganization, async (req, res) => {
  try {
    const organization = req.organization;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const employees = await User.findAndCountAll({
      where: { organization_id: organization.organization_id },
      include: [
        {
          model: User,
          as: 'manager',
          attributes: ['first_name', 'last_name', 'email']
        },
        {
          model: PayrollData,
          as: 'payroll',
          attributes: ['base_salary', 'ctc']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });

    res.json({
      success: true,
      message: 'Employees retrieved successfully',
      data: {
        employees: employees.rows,
        pagination: {
          total: employees.count,
          page,
          limit,
          pages: Math.ceil(employees.count / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Update Employee
router.put('/employees/:userId', authenticateOrganization, [
  body('first_name').optional().notEmpty().trim(),
  body('last_name').optional().notEmpty().trim(),
  body('email').optional().isEmail().normalizeEmail(),
  body('role').optional().isIn(['Employee', 'Manager', 'Admin']),
  body('department').optional().notEmpty().trim(),
  body('location').optional().notEmpty().trim(),
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
    const { userId } = req.params;
    const updateData = req.body;

    const user = await User.findOne({
      where: { 
        user_id: userId, 
        organization_id: organization.organization_id 
      }
    });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Employee not found' 
      });
    }

    await user.update(updateData);

    res.json({
      success: true,
      message: 'Employee updated successfully',
      data: user
    });

  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Deactivate Employee
router.patch('/employees/:userId/deactivate', authenticateOrganization, async (req, res) => {
  try {
    const organization = req.organization;
    const { userId } = req.params;

    const user = await User.findOne({
      where: { 
        user_id: userId, 
        organization_id: organization.organization_id 
      }
    });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Employee not found' 
      });
    }

    await user.update({ is_active: false });

    res.json({
      success: true,
      message: 'Employee deactivated successfully'
    });

  } catch (error) {
    console.error('Deactivate employee error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Add Company Policy
router.post('/policies', authenticateOrganization, [
  body('policy_title').notEmpty().trim(),
  body('policy_category').notEmpty().trim(),
  body('policy_content').notEmpty().trim(),
  body('keywords').optional().trim(),
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
    const { policy_title, policy_category, policy_content, keywords } = req.body;

    const policy = await CompanyPolicy.create({
      organization_id: organization.organization_id,
      policy_title,
      policy_category,
      policy_content,
      keywords,
      last_reviewed: new Date()
    });

    res.status(201).json({
      success: true,
      message: 'Policy created successfully',
      data: policy
    });

  } catch (error) {
    console.error('Create policy error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Get All Policies
router.get('/policies', authenticateOrganization, async (req, res) => {
  try {
    const organization = req.organization;

    const policies = await CompanyPolicy.findAll({
      where: { organization_id: organization.organization_id },
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      message: 'Policies retrieved successfully',
      data: policies
    });

  } catch (error) {
    console.error('Get policies error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

export default router;
