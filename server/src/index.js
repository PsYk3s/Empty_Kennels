import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import router from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { APP_CONFIG } from './config.js';

const app = express();
app.use(cors({ origin: APP_CONFIG.corsOrigins }));
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({ windowMs: 60000, max: 120 }));
app.use('/api', router);
app.use(errorHandler);
app.listen(APP_CONFIG.port, () => console.log(`Server running on port ${APP_CONFIG.port}`));
