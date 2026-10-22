const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const healthRouter = require('./routes/health');
const authRouter = require('./routes/auth');
const walletsRouter = require('./routes/wallets');
const transactionsRouter = require('./routes/transactions');
const categoriesRouter = require('./routes/categories');
const analyticsRouter = require('./routes/analytics');

const app = express();
const PORT = process.env.PORT || 5000;

const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./docs/swagger.json');

// Middlewares
app.use(helmet({
  contentSecurityPolicy: false, // Allow Swagger UI inline scripts & styles
}));
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Swagger Documentation
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Route Mounts
app.use('/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/wallets', walletsRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/analytics', analyticsRouter);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ success: false, error: 'Internal Server Error' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`🚀 LongWallet Backend Service Started`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`📚 Swagger: http://localhost:${PORT}/docs`);
  console.log(`🩺 Health: http://localhost:${PORT}/health`);
  console.log(`========================================`);
});
