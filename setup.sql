-- ===============================================================
-- TOUR LAGBE (Tour লাগবে) - AUTO-REPAIR SETUP (v3)
-- Multi-Seat Booking, Bus Layout, Hotel & Room Management, 6/A4 & 10/A4
-- ===============================================================

-- 1. ENSURE COLUMNS EXIST (Fixes "column does not exist" errors)
DO $$
BEGIN
    -- Columns for tl_bookings
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'tl_bookings') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tl_bookings' AND column_name='tour_name') THEN
            ALTER TABLE tl_bookings ADD COLUMN tour_name TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tl_bookings' AND column_name='is_primary') THEN
            ALTER TABLE tl_bookings ADD COLUMN is_primary BOOLEAN DEFAULT true;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tl_bookings' AND column_name='primary_booking_id') THEN
            ALTER TABLE tl_bookings ADD COLUMN primary_booking_id TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tl_bookings' AND column_name='total_group_seats') THEN
            ALTER TABLE tl_bookings ADD COLUMN total_group_seats INTEGER DEFAULT 1;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tl_bookings' AND column_name='group_seats_list') THEN
            ALTER TABLE tl_bookings ADD COLUMN group_seats_list TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tl_bookings' AND column_name='hotel_room_no') THEN
            ALTER TABLE tl_bookings ADD COLUMN hotel_room_no TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tl_bookings' AND column_name='hotel_name') THEN
            ALTER TABLE tl_bookings ADD COLUMN hotel_name TEXT;
        END IF;
    END IF;

    -- Columns for tl_tours
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'tl_tours') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tl_tours' AND column_name='tour_type') THEN
            ALTER TABLE tl_tours ADD COLUMN tour_type TEXT DEFAULT 'Day Long';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tl_tours' AND column_name='couple_extra_fee') THEN
            ALTER TABLE tl_tours ADD COLUMN couple_extra_fee NUMERIC DEFAULT 1000;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tl_tours' AND column_name='hotel_name') THEN
            ALTER TABLE tl_tours ADD COLUMN hotel_name TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tl_tours' AND column_name='sort_order') THEN
            ALTER TABLE tl_tours ADD COLUMN sort_order INTEGER DEFAULT 0;
        END IF;
    END IF;

    -- Columns for tl_expenses
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'tl_expenses') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tl_expenses' AND column_name='tour_name') THEN
            ALTER TABLE tl_expenses ADD COLUMN tour_name TEXT;
        END IF;
    END IF;

    -- Columns for tl_customer_types
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'tl_customer_types') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tl_customer_types' AND column_name='sort_order') THEN
            ALTER TABLE tl_customer_types ADD COLUMN sort_order INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tl_customer_types' AND column_name='tour_name') THEN
            ALTER TABLE tl_customer_types ADD COLUMN tour_name TEXT;
        END IF;
    END IF;
END $$;

-- 2. MASTER DATA TABLES
CREATE TABLE IF NOT EXISTS tl_notices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tl_tours (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  fee NUMERIC NOT NULL DEFAULT 0,
  tour_type TEXT DEFAULT 'Day Long',
  couple_extra_fee NUMERIC DEFAULT 1000,
  hotel_name TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tl_agents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  last_active TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tl_customer_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT UNIQUE NOT NULL,
  fee NUMERIC NOT NULL DEFAULT 0,
  tour_name TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TRANSACTIONAL TABLES
CREATE TABLE IF NOT EXISTS tl_bookings (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  address TEXT,
  gender TEXT,
  religion TEXT,
  tour_name TEXT,
  tour_fees NUMERIC DEFAULT 0,
  customer_type TEXT,
  customer_type_fees NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  advance_amount NUMERIC DEFAULT 0,
  due_amount NUMERIC DEFAULT 0,
  payment_status TEXT,
  bus_no TEXT,
  seat_no TEXT NOT NULL,
  booked_by TEXT,
  booker_code TEXT,
  is_primary BOOLEAN DEFAULT true,
  primary_booking_id TEXT,
  total_group_seats INTEGER DEFAULT 1,
  group_seats_list TEXT,
  hotel_room_no TEXT,
  hotel_name TEXT,
  booking_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tl_expenses (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  recorded_by TEXT,
  agent_code TEXT,
  tour_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. SEAT LOCKING SYSTEM
CREATE TABLE IF NOT EXISTS tl_locks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bus_no TEXT NOT NULL,
  seat_no TEXT NOT NULL,
  agent_code TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE(bus_no, seat_no)
);

-- 5. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_bookings_mobile ON tl_bookings(mobile);
CREATE INDEX IF NOT EXISTS idx_bookings_tour ON tl_bookings(tour_name);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON tl_expenses(date);

-- 6. CLEANUP FUNCTION
CREATE OR REPLACE FUNCTION clear_expired_locks() 
RETURNS void AS $$
BEGIN
  DELETE FROM tl_locks WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. REALTIME & SECURITY CONFIGURATION
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

DO $$
DECLARE
    tbl_name TEXT;
    tbl_list TEXT[] := ARRAY['tl_bookings', 'tl_locks', 'tl_agents', 'tl_tours', 'tl_customer_types', 'tl_expenses', 'tl_notices'];
BEGIN
    FOREACH tbl_name IN ARRAY tbl_list
    LOOP
        IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = tbl_name AND schemaname = 'public') THEN
            IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = tbl_name) THEN
                EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', tbl_name);
            END IF;
            EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl_name);
            EXECUTE format('DROP POLICY IF EXISTS "Allow all access to %I" ON %I', tbl_name, tbl_name);
            EXECUTE format('CREATE POLICY "Allow all access to %I" ON %I FOR ALL USING (true) WITH CHECK (true)', tbl_name, tbl_name);
        END IF;
    END LOOP;
END $$;

-- 8. DATA SYNC & CASCADING UPDATES
DO $$
BEGIN
    INSERT INTO tl_tours (name, fee)
    SELECT DISTINCT b.tour_name, 0
    FROM tl_bookings b
    LEFT JOIN tl_tours t ON b.tour_name = t.name
    WHERE t.name IS NULL AND b.tour_name IS NOT NULL
    ON CONFLICT (name) DO NOTHING;

    INSERT INTO tl_tours (name, fee)
    SELECT DISTINCT e.tour_name, 0
    FROM tl_expenses e
    LEFT JOIN tl_tours t ON e.tour_name = t.name
    WHERE t.name IS NULL AND e.tour_name IS NOT NULL
    ON CONFLICT (name) DO NOTHING;

    ALTER TABLE tl_bookings DROP CONSTRAINT IF EXISTS tl_bookings_tour_name_fkey;
    ALTER TABLE tl_bookings ADD CONSTRAINT tl_bookings_tour_name_fkey 
    FOREIGN KEY (tour_name) REFERENCES tl_tours(name) ON UPDATE CASCADE ON DELETE SET NULL;
    
    ALTER TABLE tl_expenses DROP CONSTRAINT IF EXISTS tl_expenses_tour_name_fkey;
    ALTER TABLE tl_expenses ADD CONSTRAINT tl_expenses_tour_name_fkey 
    FOREIGN KEY (tour_name) REFERENCES tl_tours(name) ON UPDATE CASCADE ON DELETE SET NULL;
END $$;
