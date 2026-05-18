import fs from 'fs';
import pg from 'pg';

const sql = fs.readFileSync(new URL('./001_init.sql', import.meta.url), 'utf8');
const pool = new pg.Pool(
	process.env.DATABASE_URL
		? { connectionString: process.env.DATABASE_URL }
		: {
				host: process.env.PGHOST || 'localhost',
				port: Number(process.env.PGPORT || 5432),
				database: process.env.PGDATABASE || 'pb_app',
				user: process.env.PGUSER || 'postgres',
				password: process.env.PGPASSWORD || 'postgres'
			}
);

await pool.query(sql);
await pool.end();
console.log('migrations complete');
