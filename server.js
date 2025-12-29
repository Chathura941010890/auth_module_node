
// Load environment variables first, before any other imports
const { loadEnvironment } = require('./app/utils/envLoader');
loadEnvironment();

const express = require('express');
const cors = require('cors');

const cookieParser = require('cookie-parser');

// Route imports
const routes = require('./app/routes/index')
const userRoutes = require('./app/routes/user.route');
const customerRoutes = require('./app/routes/customer.route');
const countryRoutes = require('./app/routes/country.route');
const factoryRoutes = require('./app/routes/factory.route');
const roleRoutes = require('./app/routes/role.route');
const screenRoutes = require('./app/routes/screen.route');
const spRoutes = require('./app/routes/special.function.route');
const departmentRoutes = require('./app/routes/department.route');
const authRoutes = require('./app/routes/auth.route');
const systemRoutes = require('./app/routes/system.route')
const permissionRoutes = require('./app/routes/permissions.route');
const apiGatewayRoute = require('./app/routes/apiGateway.route');
const EmailRoute = require('./app/routes/email.route');
const documentationRoute = require('./app/routes/documentation');
const downtimeRoutes = require('./app/routes/downtime.route');
const serviceStatusRoutes = require('./app/routes/serviceStatus.route');
const userHierarchyRoutes = require('./app/routes/userHierarchy.route');

const logger = require('./app/utils/logger');

const {callDecrypt} = require('./app/utils/AESEncrypt');
const { configureTopic, configureTopicSSE } = require('./app/kafka/config/topicConfig');

//redis
const { client } = require('./app/database/redisClient');

// Load Passport and SSO configuration only in production
let passport;
if (process.env.NODE_ENV === 'production') {
  passport = require('passport');
  require('./app/utils/SSOPassport');
}

const app = express();

// Serve static files from public directory
app.use(express.static('app/public'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error(`Unhandled Rejection at: ${promise}. Reason: ${reason} at - : ${new Date()}`);
    logger.error(reason.stack);
    // Consider graceful shutdown in production
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error(`Uncaught Exception at - : ${new Date()} message - : ${error.message}`);
    logger.error(error.stack);
    // Cleanup resources before exit
    gracefulShutdown();
    process.exit(1);
});

// Parse requests - using express built-in parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS Configuration
let allowedOrigins = [];

// Load CORS origins from environment variable
if (process.env.CORS_ALLOWED_ORIGINS) {
    allowedOrigins = process.env.CORS_ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
} else {
    // Fallback to default origins if env variable is not set
    allowedOrigins = [
        'https://apigateway.inqcloud.com:49170',
        'https://backoffice.inqcloud.com:49171',
        'https://qc.inqcloud.com:49158',
        'https://smf.inqcloud.com:4000',
        'https://smf.inqcloud.com:8080',
        'http://172.33.0.107:8080',
        'https://downtime.inqcloud.com:49174',
        'http://172.33.0.107:49179',
        'https://supplierportal.inqcloud.com:49182',
        'http://172.33.0.107:49186',
        'https://gtp.inqcloud.com:49190',
        'http://localhost:4000',
        'https://helpdesk.inqcloud.com:49189',
        'https://mo.inqcloud.com:49195',
        'http://localhost:49194',
        'http://172.33.0.107:49999',
        'http://172.33.0.107:50001',
        'http://172.33.0.110:49201',
    ];
}

// Middleware to dynamically update CORS origins
app.use(cors({    
    origin: (origin, callback) => {
      
        if (allowedOrigins.includes('*')) {
            callback(null, true);
        } else if (!origin || allowedOrigins.includes(origin)) {
          
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

// Swagger setup
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Auth Module API',
    version: '1.0.0',
    description: 'API documentation for the Auth Module microservice',
  },
  servers: [
    {
      url: `http://localhost:${process.env.PORT || 49171}/auth/api/v1`,
      description: 'Development server',
    },
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
      },
    },
  },
  security: [{ ApiKeyAuth: [] }],
};

const swaggerOptions = {
  swaggerDefinition,
  apis: ['./app/routes/*.js', './app/controllers/*.js', './app/models/*.js'], // You can add more paths for JSDoc
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

//SSO Login (only in production)
if (process.env.NODE_ENV === 'production') {
  app.use(passport.initialize());
}

app.use(cookieParser());

app.get('/auth/api/v1/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Enhanced health check endpoint
app.get('/healthCheck', async (req, res) => {
    const healthCheck = {
      uptime: process.uptime(),
      message: 'OK',
      timestamp: Date.now(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.APP_VERSION || '1.0.0'
    };

    try {
      // Test Redis connection
      await client.ping();
      healthCheck.redis = 'connected';
    } catch (error) {
      healthCheck.redis = 'disconnected';
      healthCheck.message = 'Partial';
    }
  
    try {
      const statusCode = healthCheck.message === 'OK' ? 200 : 503;
      res.status(statusCode).json(healthCheck);
    } catch (error) {
      healthCheck.message = error.message;
      res.status(503).json(healthCheck);
    }
});

// Block common API testing tools
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    const userAgent = req.headers['user-agent'] || '';
  
    if (userAgent.includes('Postman') || 
        userAgent.includes('Insomnia') || 
        userAgent.includes('curl')) {
      return res.status(403).json({ error: 'API testing tools are not allowed' });
    }
  }
  
  next();
});

// Middleware to validate API key (currently disabled for backward compatibility)
// TODO: Enable this in production with proper API key management
app.use(async (req, res, next) => {
  // Skip health check and other public endpoints
  if (req.path === '/healthCheck') {
    return next();
  }

  // Only enforce API key validation in production
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  if (!req.headers['x-api-key']) {
    return res.status(403).json({ error: 'API key required' });
  }

  try {
    const { key, code } = JSON.parse(req.headers['x-api-key']);
    const decryptValue = await callDecrypt(key, code.toString());
      
    if (!key || !code || decryptValue !== "success") {
      return res.status(403).json({ error: 'Invalid API key' });
    }

    next();
  } catch (error) {
    logger.error('API key validation error:', error);
    return res.status(403).json({ error: 'API key validation failed' });
  }
});

// Register all other routes - keeping exact same structure for backward compatibility
app.use('/auth/api/v1', 
  routes, 
  userRoutes, 
  customerRoutes, 
  downtimeRoutes,
  departmentRoutes, 
  authRoutes,
  systemRoutes, 
  spRoutes, 
  screenRoutes, 
  roleRoutes, 
  factoryRoutes, 
  countryRoutes,
  permissionRoutes,
  apiGatewayRoute,
  EmailRoute,
  documentationRoute,
  serviceStatusRoutes,
  userHierarchyRoutes
);

// Global Error Handler - moved to the end to catch all route errors
app.use((err, req, res, next) => {
    try {
        logger.error(`Global error caught at ${new Date().toISOString()}: ${err.message}`);
        logger.error('Stack trace:', err.stack);
        logger.error('Request details:', {
          method: req.method,
          url: req.url,
          headers: req.headers,
          body: req.body
        });
        
        // Send standardized error response
        res.status(err.statusCode || 500).json({
          status: 'Failure',
          message: err.message || 'Internal Server Error',
          timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error(`Error in global error handler: ${error.message}`);
        res.status(500).json({
          status: 'Failure',
          message: 'Internal Server Error'
        });
    }
});

// Graceful shutdown function
const gracefulShutdown = async () => {
  logger.info('Starting graceful shutdown...');
  
  try {
    // Close Redis connection
    if (client && client.isOpen) {
      await client.quit();
      logger.info('Redis connection closed');
    }
    
    // Add other cleanup tasks here (database connections, etc.)
    
    logger.info('Graceful shutdown completed');
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
  }
};

// Configure Kafka Topics with retry logic
const initializeKafka = async (retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      await configureTopic();
      await configureTopicSSE();
      logger.info('Kafka topics configured successfully');
      return;
    } catch (err) {
      logger.error(`Kafka topic configuration failed (attempt ${i + 1}/${retries}):`, err);
      if (i === retries - 1) {
        logger.error('Kafka initialization failed after all retries');
        // Don't exit the process, let the app start without Kafka
      } else {
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }
};

// Initialize Kafka
initializeKafka();

// Handle graceful shutdown signals
process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await gracefulShutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await gracefulShutdown();
  process.exit(0);
});

// Start server
const PORT = process.env.PORT || 49171;
const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
    logger.info(`🚀 Auth service listening on ${HOST}:${PORT}`);
    logger.info(`📊 Health check available at http://${HOST}:${PORT}/healthCheck`);
    logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Handle server errors
server.on('error', (error) => {
  logger.error('Server error:', error);
});

// Export app for testing
module.exports = app;

