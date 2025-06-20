import express from 'express';
import authRoutes from './auth.js';
import chatRoutes from './chat.js';
import organizationRoutes from './organization.js';
import adminRoutes from './admin.js';

const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'VipraCo Backend is running!',
    timestamp: new Date().toISOString()
  });
});

// Routes
router.use('/auth', authRoutes);
router.use('/chat', chatRoutes);
router.use('/organization', organizationRoutes);
router.use('/admin', adminRoutes);

export default router;
