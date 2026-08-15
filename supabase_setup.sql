-- Supabase Setup Script for Tour Management System
-- Use this script in the Supabase SQL Editor to set up the database schema.

-- 1. Agents/Bookers Table
CREATE TABLE IF NOT EXISTS tl_agents (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Active Tours Table
CREATE TABLE IF NOT EXISTS tl_tours (
    name TEXT PRIMARY KEY,
    fee INTEGER NOT NULL DEFAULT 0
);

-- 3. Customer Pricing Types
CREATE TABLE IF NOT EXISTS tl_customer_types (
    type TEXT PRIMARY KEY,
    fee INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER DEFAULT 0
);

-- 4. Bookings Table
CREATE TABLE IF NOT EXISTS tl_bookings (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    mobile TEXT NOT NULL,
    address TEXT,
    gender TEXT,
    religion TEXT,
    tour_name TEXT REFERENCES tl_tours(name),
    tour_fees INTEGER NOT NULL,
    customer_type TEXT,
    customer_type_fees INTEGER NOT NULL DEFAULT 0,
    discount_amount INTEGER NOT NULL DEFAULT 0,
    advance_amount INTEGER NOT NULL DEFAULT 0,
    due_amount INTEGER NOT NULL DEFAULT 0,
    payment_status TEXT CHECK (payment_status IN ('Paid', 'Partial', 'Due')),
    bus_no TEXT,
    seat_no TEXT,
    booked_by TEXT,
    booker_code TEXT,
    booking_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Expenses Table
CREATE TABLE IF NOT EXISTS tl_expenses (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    description TEXT,
    date TEXT NOT NULL,
    recorded_by TEXT,
    agent_code TEXT,
    tour_name TEXT
);

-- 6. Seat Locks (Real-time collaboration)
CREATE TABLE IF NOT EXISTS tl_locks (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    bus_no TEXT NOT NULL,
    seat_no TEXT NOT NULL,
    agent_code TEXT NOT NULL,
    agent_name TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE(bus_no, seat_no)
);

-- 7. Notices / Announcements (Notice Board)
CREATE TABLE IF NOT EXISTS tl_notices (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'info', -- 'info', 'success', 'error'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Replication for real-time updates (Crucial for live booking)
ALTER PUBLICATION supabase_realtime ADD TABLE tl_bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE tl_locks;
ALTER PUBLICATION supabase_realtime ADD TABLE tl_notices;
ALTER PUBLICATION supabase_realtime ADD TABLE tl_expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE tl_agents;
ALTER PUBLICATION supabase_realtime ADD TABLE tl_tours;

-- Row Level Security (RLS) - Basic "Public" access for this app structure
ALTER TABLE tl_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tl_tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE tl_customer_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE tl_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tl_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE tl_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tl_notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public full access" ON tl_agents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access" ON tl_tours FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access" ON tl_customer_types FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access" ON tl_bookings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access" ON tl_expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access" ON tl_locks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access" ON tl_notices FOR ALL USING (true) WITH CHECK (true);
