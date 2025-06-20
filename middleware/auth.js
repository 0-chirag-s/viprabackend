import jwt from 'jsonwebtoken';
import { User, Organization } from '../models/index.js';

export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access token required' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user details
    const user = await User.findOne({
      where: { 
        user_id: decoded.user_id, 
        organization_id: decoded.organization_id,
        is_active: true 
      },
      include: [{
        model: Organization,
        as: 'organization',
        attributes: ['org_name', 'subscription_plan', 'is_active']
      }]
    });

    if (!user || !user.organization.is_active) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid or inactive user' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid token' 
    });
  }
};

export const authenticateOrganization = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access token required' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.type !== 'organization') {
      return res.status(401).json({ 
        success: false, 
        message: 'Organization access required' 
      });
    }

    const organization = await Organization.findOne({
      where: { 
        organization_id: decoded.organization_id,
        is_active: true 
      }
    });

    if (!organization) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid or inactive organization' 
      });
    }

    req.organization = organization;
    next();
  } catch (error) {
    console.error('Organization auth middleware error:', error);
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid token' 
    });
  }
};
