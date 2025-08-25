import express from 'express';
import cors from 'cors';

const app = express();

// CORS middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:4173', 'https://buybrics.vercel.app', 'https://docs.google.com'],
  methods: ['GET', 'POST'],
  credentials: true,
}));

app.use(express.json());

// Utility function to ensure JSON responses
const sendJSONResponse = (res, statusCode, data) => {
  try {
    res.status(statusCode).json(data);
  } catch (error) {
    console.error('Failed to send JSON response:', error);
    // Fallback to basic JSON response
    try {
      res.status(statusCode).json({
        success: false,
        message: 'Response serialization failed',
        error: 'InternalServerError',
        code: 500
      });
    } catch (fallbackError) {
      console.error('Fallback response also failed:', fallbackError);
      // Last resort - send plain text
      res.status(statusCode).send('{"success":false,"message":"Server error","error":"InternalServerError","code":500}');
    }
  }
};

// Test endpoint for deposits API
app.get('/api/deposits/test', (req, res) => {
  console.log('✅ Deposits test endpoint hit');
  sendJSONResponse(res, 200, {
    success: true,
    message: 'Deposits API is working',
    timestamp: new Date().toISOString(),
    test: true
  });
});

// Test endpoint to trigger JSON error response
app.post('/api/deposits/test-error', (req, res) => {
  console.log('✅ Deposits test error endpoint hit');
  sendJSONResponse(res, 400, {
    success: false,
    message: 'This is a test error response',
    error: 'TestError',
    code: 400,
    details: 'Testing JSON error handling'
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  console.log('✅ Health endpoint hit');
  sendJSONResponse(res, 200, { 
    success: true,
    status: 'healthy',
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('❌ Global error handler caught:', error);
  sendJSONResponse(res, 500, {
    success: false,
    message: 'An unexpected error occurred',
    error: 'InternalServerError',
    code: 500,
    details: error.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  sendJSONResponse(res, 404, {
    success: false,
    message: 'The requested endpoint does not exist',
    error: 'NotFoundError',
    code: 404
  });
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🚀 Test server running on port ${PORT}`);
  console.log(`📝 Test endpoints:`);
  console.log(`   GET  http://localhost:${PORT}/api/deposits/test`);
  console.log(`   POST http://localhost:${PORT}/api/deposits/test-error`);
  console.log(`   GET  http://localhost:${PORT}/api/health`);
});
