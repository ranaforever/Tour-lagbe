
export enum Gender {
  MALE = 'Male',
  FEMALE = 'Female',
  OTHERS = 'Others'
}

export enum Religion {
  MUSLIM = 'Muslim',
  HINDUISM = 'Hinduism',
  BUDDHISM = 'Buddhism',
  CHRISTIANITY = 'Christianity',
  OTHERS = 'Others'
}

export interface CoPassengerInput {
  seatNo: string;
  name?: string;
  gender: Gender;
  religion: Religion;
  customerType?: string;
  customerTypeFees?: number;
}

export interface BookingInfo {
  id: string;
  name: string;
  mobile: string;
  address: string;
  gender: Gender;
  religion: Religion;
  tourName: string;
  tourFees: number;
  customerType?: string;
  customerTypeFees: number;
  discountAmount: number;
  advanceAmount: number;
  dueAmount: number;
  paymentStatus: 'Paid' | 'Partial' | 'Due';
  busNo: string;
  seatNo: string;
  bookedBy: string;
  bookerCode: string;
  bookingDate: string;
  // Multi-seat / grouping metadata
  isPrimary?: boolean;
  primaryBookingId?: string;
  totalGroupSeats?: number;
  groupSeatsList?: string[];
  // Hotel Assignment
  hotelId?: string;
  hotelName?: string;
  hotelRoomNo?: string;
  hotelRoomType?: string;
}

export interface SeatLock {
  id?: string;
  bus_no: string;
  seat_no: string;
  agent_code: string;
  agent_name: string;
  expires_at: string;
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  description: string;
  date: string;
  recordedBy: string;
  agentCode: string;
  tourName?: string;
}

export interface SeatData {
  id: string;
  isBooked: boolean;
  bookingInfo?: BookingInfo;
  lockInfo?: SeatLock;
  label?: string;
  isDisabled?: boolean;
}

export interface BusData {
  busId: string;
  seats: SeatData[];
  layoutConfig?: BusCustomLayout;
}

export type TourType = 'Day Long' | 'Relax';

export interface Tour {
  name: string;
  fee: number;
  sort_order?: number;
  tour_type?: TourType; // 'Day Long' or 'Relax'
  couple_extra_fee?: number; // Extra fee for couples if relax tour
  hotel_applicable?: boolean; // Whether hotel is applicable
  hotel_name?: string;
  default_hotel_id?: string;
  bus_layout_id?: string;
}

export interface Booker {
  code: string;
  name: string;
  phone?: string;
  mobile?: string;
  last_active?: string;
}

export interface CustomerType {
  type: string;
  fee: number;
  sort_order?: number;
  tour_name?: string;
}

export interface BusCustomLayout {
  id: string;
  name: string;
  tourName?: string; // If tied to a specific tour or 'default'
  leftColumns: number; // 1 or 2
  rightColumns: number; // 1 or 2
  rows: string[]; // e.g., ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']
  hasRearBench: boolean;
  rearBenchSeats: number; // e.g. 5 or 4
  rearRowLetter: string; // e.g. 'K'
  disabledSeats: string[]; // List of seat IDs that are disabled (empty space)
  customLabels?: Record<string, string>; // Optional custom seat name (e.g. { "A1": "VIP1" })
}

export type RoomType = 'Single' | 'Couple' | 'Combine4' | 'Combine5' | 'Combine6' | 'Custom';

export interface HotelRoom {
  id: string;
  hotelId: string;
  hotelName: string;
  tourName: string;
  roomNo: string;
  roomType: RoomType;
  capacity: number; // Single: 1, Couple: 2, Combine4: 4, Combine5: 5, Combine6: 6, Custom: N
  floor?: string;
  notes?: string;
  assignedBookingIds: string[]; // Booking IDs assigned to this room
}

export interface Hotel {
  id: string;
  name: string;
  location: string;
  tourName?: string;
  contactNumber?: string;
  address?: string;
}

export interface Notice {
  id: string | number;
  content: string;
  type?: 'success' | 'error' | 'info' | string;
  is_active?: boolean;
  created_at?: string;
}

