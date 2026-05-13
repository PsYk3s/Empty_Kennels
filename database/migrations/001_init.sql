CREATE TABLE IF NOT EXISTS events (id SERIAL PRIMARY KEY, name TEXT NOT NULL, starts_at TIMESTAMP, ends_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS suppliers (id SERIAL PRIMARY KEY, supplier_name TEXT NOT NULL, supplier_email TEXT NOT NULL, is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS catalogues (id SERIAL PRIMARY KEY, title TEXT NOT NULL, file_url TEXT NOT NULL, version INTEGER DEFAULT 1, is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS devices (id SERIAL PRIMARY KEY, device_identifier TEXT UNIQUE NOT NULL, event_id INTEGER REFERENCES events(id), last_seen_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS leads (id SERIAL PRIMARY KEY, uuid TEXT UNIQUE NOT NULL, first_name TEXT NOT NULL, last_name TEXT NOT NULL, company TEXT, email TEXT NOT NULL, phone TEXT, interest_area TEXT, notes TEXT, event_id INTEGER REFERENCES events(id), created_at TIMESTAMP NOT NULL, updated_at TIMESTAMP, last_synced_at TIMESTAMP, sync_status TEXT, email_sent_status TEXT, brevo_sync_status TEXT);
CREATE TABLE IF NOT EXISTS lead_suppliers (lead_id INTEGER REFERENCES leads(id), supplier_id INTEGER REFERENCES suppliers(id), PRIMARY KEY (lead_id, supplier_id));
CREATE TABLE IF NOT EXISTS sync_logs (id SERIAL PRIMARY KEY, lead_uuid TEXT, status TEXT, attempt INTEGER DEFAULT 1, error_message TEXT, created_at TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS email_logs (id SERIAL PRIMARY KEY, lead_uuid TEXT UNIQUE, recipient TEXT, cc TEXT, sent_at TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS brevo_logs (id SERIAL PRIMARY KEY, lead_uuid TEXT UNIQUE, status TEXT, detail TEXT, created_at TIMESTAMP DEFAULT NOW());
