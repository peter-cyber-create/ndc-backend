// backend/index.js
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import compression from 'compression';
import path from 'path';

// Import routes
import userRoutes from './routes/users.js';
import activityRoutes from './routes/activities.js';
import speakerRoutes from './routes/speakers.js';
import sessionRoutes from './routes/sessions.js';
import announcementRoutes from './routes/announcements.js';
import registrationRoutes from './routes/registrations.js';
import abstractRoutes from './routes/abstracts.js';
import reviewRoutes from './routes/reviews.js';
import contactRoutes from './routes/contacts.js';
import sponsorshipRoutes from './routes/sponsorships.js';
import uploadRoutes from './routes/uploads.js';
import adminRoutes from './routes/admin.js';

// Import middleware
import { 
  securityMiddleware, 
  productionRateLimit, 
  sanitizeInput,
  requestLogger 
} from './middleware/auth.js';
import { verifyEmailConfig } from './middleware/emailService.js';

// Import logger
import logger, { stream } from './config/logger.js';

// Import database utilities
import { testConnection, healthCheck } from './config/db.js';

const app = express();

// Security middleware (must be first)
app.use(securityMiddleware);

// Trust proxy for proper IP detection behind load balancers
app.set('trust proxy', 1);

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // For development, allow localhost origins
    const allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3001'
    ];
    
    // Add environment-based origins if they exist
    if (process.env.ALLOWED_ORIGINS) {
      allowedOrigins.push(...process.env.ALLOWED_ORIGINS.split(','));
    }
    if (process.env.FRONTEND_URL && !allowedOrigins.includes(process.env.FRONTEND_URL)) {
      allowedOrigins.push(process.env.FRONTEND_URL);
    }
    
    logger.info(`CORS allowed origins: ${allowedOrigins.join(', ')}`);
    logger.info(`CORS request origin: ${origin}`);
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked request from: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-CSRF-Token'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count']
};

app.use(cors(corsOptions));

// Body parsing middleware with security limits
app.use(express.json({ 
  limit: process.env.MAX_FILE_SIZE || '10mb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      throw new Error('Invalid JSON');
    }
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: process.env.MAX_FILE_SIZE || '10mb' 
}));

// Compression middleware
app.use(compression());

// Request logging with Winston
app.use(morgan('combined', { stream }));

// Custom request logging
app.use(requestLogger);

// Input sanitization
app.use(sanitizeInput);

// Production rate limiting
app.use(productionRateLimit);

// Initialize email service
verifyEmailConfig();

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await healthCheck();
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'NTLP Backend API',
      version: '1.0.0',
      uptime: `${Math.floor(uptime / 60)} minutes`,
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`
      },
      database: dbHealth,
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    logger.error('Health check failed', error);
    res.status(503).json({ 
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: 'Service unavailable'
    });
  }
});

// Metrics endpoint (if enabled)
if (process.env.METRICS_ENABLED === 'true') {
  app.get('/metrics', (req, res) => {
    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    };
    
    res.json(metrics);
  });
}

// API Documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'NTLP Conference Management API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      registrations: '/api/registrations',
      activities: '/api/activities',
      speakers: '/api/speakers', 
      sessions: '/api/sessions',
      announcements: '/api/announcements',
      abstracts: '/api/abstracts',
      reviews: '/api/reviews',
      contacts: '/api/contacts',
      sponsorships: '/api/sponsorships',
      uploads: '/api/uploads',
      admin: '/api/admin',
      'session-registrations': '/api/register/sessions',
      'activity-registrations': '/api/register/activities'
    },
    health: '/health',
    metrics: process.env.METRICS_ENABLED === 'true' ? '/metrics' : 'disabled',
    features: [
      'Conference registration management',
      'Abstract submission and review system', 
      'Speaker and session management',
      'Activity and event coordination',
      'Announcement system',
      'Full peer review workflow',
      'Production-ready security',
      'Comprehensive logging',
      'Rate limiting and monitoring'
    ]
  });
});

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/speakers', speakerRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/register', registrationRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/abstracts', abstractRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/sponsorships', sponsorshipRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/admin', adminRoutes);

// Serve static files (uploads)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// 404 handler
app.use('*', (req, res) => {
  logger.warn(`Route not found: ${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    available_endpoints: [
      '/health',
      '/api',
      '/api/registrations',
      '/api/activities', 
      '/api/speakers',
      '/api/sessions',
      '/api/announcements',
      '/api/abstracts',
      '/api/reviews',
      '/api/contacts',
      '/api/sponsorships',
      '/api/uploads',
      '/api/admin',
      '/api/register'
    ]
  });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  // Log the error
  logger.error('Unhandled error', err, req);
  
  // Don't expose internal errors in production
  const isProduction = process.env.NODE_ENV === 'production';
  const errorMessage = isProduction ? 'Internal server error' : err.message;
  const errorStack = isProduction ? undefined : err.stack;
  
  res.status(err.status || 500).json({ 
    success: false,
    error: errorMessage,
    timestamp: new Date().toISOString(),
    ...(errorStack && { stack: errorStack }),
    notification: {
      type: 'error',
      title: 'Server Error',
      message: 'An unexpected error occurred. Please try again.',
      duration: 5000,
      icon: '❌',
      actions: [
        { label: 'Refresh Page', action: 'reload' },
        { label: 'Contact Support', action: 'contact_support' }
      ]
    }
  });
});

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  try {
    // Close database connections
    const { closePool } = await import('./config/db.js');
    await closePool();
    
    // Close server
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
    
    // Force exit after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
    
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start server
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, async () => {
  logger.info(`🚀 NTLP Backend API running on ${HOST}:${PORT}`);
  logger.info(`📊 Health check: http://${HOST}:${PORT}/health`);
  logger.info(`📚 API docs: http://${HOST}:${PORT}/api`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Test database connection
  try {
    await testConnection();
    logger.info('✅ Database connection established');
  } catch (error) {
    logger.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
});

export default app;
