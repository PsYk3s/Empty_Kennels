import pg from 'pg';
import { APP_CONFIG } from '../config.js';

const { Pool } = pg;
export const pool = new Pool({ connectionString: APP_CONFIG.databaseUrl });
