import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';
import enhancedNlpService from '../services/nlpService.js';

const router = express.Router();

// Enhanced chat endpoint
router.post('/', authenticateToken, [
  body('message').notEmpty().trim().isLength({ max: 2000 }),
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

    const { message } = req.body;
    const user = req.user;

    console.log(`Processing query for user ${user.user_id}: "${message}"`);

    // Process query with enhanced NLP service
    const response = await enhancedNlpService.processQuery(
      message, 
      user.user_id, 
      user.organization_id
    );

    res.json({
      success: response.success,
      message: 'Query processed successfully',
      data: {
        query: message,
        answer: response.answer,
        confidence: response.confidence,
        intent: response.intent,
        response_source: response.response_source,
        suggestions: response.suggestions,
        processing_info: {
          user_id: user.user_id,
          organization: user.organization.org_name,
          timestamp: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    console.error('Enhanced chat error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      data: {
        query: req.body.message,
        answer: 'I apologize, but I encountered an error processing your request. Please try again or contact your HR team for assistance.',
        confidence: 0,
        response_source: 'fallback'
      }
    });
  }
});

// Get NLP service status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const status = enhancedNlpService.getStatus();
    res.json({
      success: true,
      message: 'NLP service status',
      data: status
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Test endpoint for debugging
router.post('/test', authenticateToken, [
  body('message').notEmpty().trim(),
], async (req, res) => {
  try {
    const { message } = req.body;
    const user = req.user;

    const startTime = Date.now();
    const response = await enhancedNlpService.processQuery(
      message, 
      user.user_id, 
      user.organization_id
    );
    const processingTime = Date.now() - startTime;

    res.json({
      success: true,
      message: 'Test query processed',
      data: {
        ...response,
        processing_time_ms: processingTime,
        test_mode: true
      }
    });
  } catch (error) {
    console.error('Test endpoint error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Test failed',
      error: error.message
    });
  }
});

export default router;
