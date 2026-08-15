-- ==============================================================================
-- TOUR & BUS TICKET MANAGEMENT SYSTEM - FULL UPDATED SUPABASE SQL SCHEMA
-- ==============================================================================
-- এই কোডটি Supabase SQL Editor-এ রান করলে আগের টেবিলগুলো নিরাপদভাবে ড্রপ করে
-- সম্পূর্ণ নতুন, ত্রুটিমুক্ত ও আপডেটেড টেবিল, রিয়েলটাইম পাবলিকেশন এবং পারমিশন পলিসি সেট করবে।
-- ==============================================================================

-- ১. পুরনো টেবিলগুলো ড্রপ করুন (Clean Reset)
DROP TABLE IF EXISTS tl_bookings CASCADE;
DROP TABLE IF EXISTS tl_expenses CASCADE;
DROP TABLE IF EXISTS tl_locks CASCADE;
DROP TABLE IF EXISTS tl_notices CASCADE;
DROP TABLE IF EXISTS tl_customer_types CASCADE;
DROP TABLE IF EXISTS tl_tours CASCADE;
DROP TABLE IF EXISTS tl_agents CASCADE;

-- ==============================================================================
-- ২. টেবিল তৈরি (Create Tables)
-- ==============================================================================

-- (ক) এজেন্ট ও ইউজার টেবিল (Agents / Bookers)
CREATE TABLE tl_agents (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    mobile TEXT,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- (খ) ট্যুর ও রুট টেবিল (Active Tours & Routes)
CREATE TABLE tl_tours (
    name TEXT PRIMARY KEY,
    fee NUMERIC NOT NULL DEFAULT 0,
    departure_date TEXT,
    return_date TEXT,
    destination TEXT
);

-- (গ) কাস্টমার টাইপ ও সারচার্জ ক্যাটাগরি (Customer Pricing Types)
CREATE TABLE tl_customer_types (
    type TEXT PRIMARY KEY,
    fee NUMERIC NOT NULL DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    tour_name TEXT
);

-- (ঘ) প্রধান বুকিং ও প্যাসেঞ্জার টেবিল (Bookings & Seat Allocation)
CREATE TABLE tl_bookings (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    mobile TEXT NOT NULL,
    address TEXT,
    gender TEXT DEFAULT 'MALE',
    religion TEXT DEFAULT 'Islam',
    tour_name TEXT,
    tour_fees NUMERIC NOT NULL DEFAULT 0,
    customer_type TEXT,
    customer_type_fees NUMERIC NOT NULL DEFAULT 0,
    discount_amount NUMERIC NOT NULL DEFAULT 0,
    advance_amount NUMERIC NOT NULL DEFAULT 0,
    due_amount NUMERIC NOT NULL DEFAULT 0,
    payment_status TEXT CHECK (payment_status IN ('Paid', 'Partial', 'Due')),
    bus_no TEXT,
    seat_no TEXT,
    booked_by TEXT,
    booker_code TEXT,
    booking_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_primary BOOLEAN DEFAULT TRUE,
    primary_booking_id TEXT,
    total_group_seats INTEGER DEFAULT 1,
    group_seats_list TEXT,
    hotel_room_no TEXT,
    hotel_name TEXT
);

-- (ঙ) খরচ ও ব্যয় টেবিল (Expense Tracker)
CREATE TABLE tl_expenses (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    description TEXT,
    date TEXT NOT NULL,
    recorded_by TEXT,
    agent_code TEXT,
    tour_name TEXT
);

-- (চ) লাইভ সিট লক টেবিল (Real-Time Collaborative Seat Locking)
CREATE TABLE tl_locks (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    bus_no TEXT NOT NULL,
    seat_no TEXT NOT NULL,
    agent_code TEXT NOT NULL,
    agent_name TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT unique_bus_seat_lock UNIQUE(bus_no, seat_no)
);

-- (ছ) নোটিশ ও গ্লোবাল কনফিগ টেবিল (Notices, Broadcasts & Cloud Settings)
CREATE TABLE tl_notices (
    id TEXT PRIMARY KEY,
    title TEXT,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'info', -- 'info', 'success', 'error'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- ৩. ইনডেক্স তৈরি (Performance Indexing)
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_tl_bookings_bus_seat ON tl_bookings(bus_no, seat_no);
CREATE INDEX IF NOT EXISTS idx_tl_bookings_mobile ON tl_bookings(mobile);
CREATE INDEX IF NOT EXISTS idx_tl_bookings_booker ON tl_bookings(booker_code);
CREATE INDEX IF NOT EXISTS idx_tl_bookings_tour ON tl_bookings(tour_name);
CREATE INDEX IF NOT EXISTS idx_tl_locks_bus_seat ON tl_locks(bus_no, seat_no);
CREATE INDEX IF NOT EXISTS idx_tl_expenses_tour ON tl_expenses(tour_name);

-- ==============================================================================
-- ৪. Row Level Security (RLS) ও পারমিশন এনাবল করা
-- ==============================================================================
ALTER TABLE tl_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tl_tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE tl_customer_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE tl_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tl_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE tl_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tl_notices ENABLE ROW LEVEL SECURITY;

-- ফুল এক্সেস পলিসি তৈরি (Public Full Access Policies)
CREATE POLICY "Allow all access to tl_agents" ON tl_agents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to tl_tours" ON tl_tours FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to tl_customer_types" ON tl_customer_types FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to tl_bookings" ON tl_bookings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to tl_expenses" ON tl_expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to tl_locks" ON tl_locks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to tl_notices" ON tl_notices FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- ৫. রিয়েল-টাইম লাইভ সিংক পাবলিকেশন (Supabase Realtime Publication)
-- ==============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE tl_bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE tl_locks;
ALTER PUBLICATION supabase_realtime ADD TABLE tl_notices;
ALTER PUBLICATION supabase_realtime ADD TABLE tl_expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE tl_agents;
ALTER PUBLICATION supabase_realtime ADD TABLE tl_tours;
ALTER PUBLICATION supabase_realtime ADD TABLE tl_customer_types;

-- ==============================================================================
-- ৬. প্রাথমিক ডেমো / ডিফল্ট ডাটা যুক্ত করা (Initial Seed Data)
-- ==============================================================================

-- ডিফল্ট এজেন্ট
INSERT INTO tl_agents (code, name, phone, mobile) VALUES
('ADMIN', 'Super Admin (System)', '01625000000', '01625000000'),
('KS101', 'Kazi Shetu', '01711223344', '01711223344'),
('MR102', 'Masud Rana', '01811223344', '01811223344'),
('AK103', 'Abul Kalam', '01911223344', '01911223344')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, phone = EXCLUDED.phone, mobile = EXCLUDED.mobile;

-- ডিফল্ট ট্যুর
INSERT INTO tl_tours (name, fee) VALUES
('Cox Bazar Executive Tour', 4500),
('Sajek Valley Luxury Tour', 5500),
('Sylhet Ratargul Adventure', 3800),
('Bandarban Nilgiri Tour', 4800)
ON CONFLICT (name) DO UPDATE SET fee = EXCLUDED.fee;

-- ডিফল্ট কাস্টমার টাইপ ও ফি
INSERT INTO tl_customer_types (type, fee, sort_order) VALUES
('Standard / General', 0, 1),
('Solo Traveler (Single Room)', 1500, 2),
('Couple (Double Bed)', 1000, 3),
('VIP Front Seat', 500, 4),
('Child (Under 5 Years)', -1000, 5)
ON CONFLICT (type) DO UPDATE SET fee = EXCLUDED.fee, sort_order = EXCLUDED.sort_order;

-- স্বাগতম নোটিশ
INSERT INTO tl_notices (id, title, content, type, is_active) VALUES
('welcome_note', 'System Notice', '🎉 সফলভাবে ট্যুর ও সিট বুকিং সিস্টেম ডাটাবেজ আপডেট সম্পন্ন হয়েছে। শুভ বুকিং!', 'success', true)
ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, is_active = EXCLUDED.is_active;

-- ==============================================================================
-- সম্পন্ন! আপনার ডাটাবেজ এখন সম্পূর্ণ প্রস্তুত ও আপ-টু-ডেট।
-- ==============================================================================
