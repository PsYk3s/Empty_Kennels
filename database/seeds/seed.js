import pg from 'pg'; const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
await pool.query("INSERT INTO events(name) VALUES ('Trade Show 2026') ON CONFLICT DO NOTHING");
await pool.query("INSERT INTO suppliers(supplier_name,supplier_email,is_active) VALUES ('Supplier A','a@supplier.com',true),('Supplier B','b@supplier.com',true) ON CONFLICT DO NOTHING");
await pool.query("INSERT INTO catalogues(title,file_url,version,is_active) VALUES ('Sample Catalogue','/catalogues/sample.pdf',1,true) ON CONFLICT DO NOTHING");
await pool.end(); console.log('seed complete');
