
import { SeatData, Tour, Booker, CustomerType, BusCustomLayout, Hotel, HotelRoom } from './types';

export const BUSINESS_INFO = {
  name: "Tour লাগবে",
  motto: "আপনার বিশ্বস্ত ভ্রমণ সঙ্গী",
  logo: "https://i.ibb.co/gb4jzgXj/Orange-and-Blue-Travel-Agency-Logo-1-1.png",
  address: "Kazi General Store, Hindu Barir Mor, Board Bazar, Gazipur",
  facebook: "https://www.facebook.com/tourlagbee",
  phonePrefix: "+880"
};

export const DEFAULT_BUS_LAYOUT: BusCustomLayout = {
  id: 'standard-45',
  name: 'Standard 45-Seat (2x2)',
  leftColumns: 2,
  rightColumns: 2,
  rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
  hasRearBench: true,
  rearBenchSeats: 5,
  rearRowLetter: 'K',
  disabledSeats: []
};

export const BUS_LAYOUT_PRESETS: BusCustomLayout[] = [
  {
    id: 'standard-45',
    name: 'Standard Coach (45 Seats 2x2 + 5 Back)',
    leftColumns: 2,
    rightColumns: 2,
    rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
    hasRearBench: true,
    rearBenchSeats: 5,
    rearRowLetter: 'K',
    disabledSeats: []
  },
  {
    id: 'standard-41',
    name: 'Standard Coach (41 Seats 2x2 + 5 Back)',
    leftColumns: 2,
    rightColumns: 2,
    rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
    hasRearBench: true,
    rearBenchSeats: 5,
    rearRowLetter: 'J',
    disabledSeats: []
  },
  {
    id: 'business-28',
    name: 'Business Class (28 Seats 2x1 VIP)',
    leftColumns: 2,
    rightColumns: 1,
    rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
    hasRearBench: true,
    rearBenchSeats: 4,
    rearRowLetter: 'J',
    disabledSeats: []
  },
  {
    id: 'minibus-28',
    name: 'Mini Bus / Coaster (28 Seats 2x2)',
    leftColumns: 2,
    rightColumns: 2,
    rows: ['A', 'B', 'C', 'D', 'E', 'F'],
    hasRearBench: true,
    rearBenchSeats: 4,
    rearRowLetter: 'G',
    disabledSeats: []
  }
];

export const TOURS: Tour[] = [
  { name: "Sajek Valley", fee: 4500, tour_type: 'Relax', couple_extra_fee: 1500, hotel_applicable: true },
  { name: "Cox's Bazar Relax", fee: 6500, tour_type: 'Relax', couple_extra_fee: 2000, hotel_applicable: true },
  { name: "Sylhet Day Long", fee: 2200, tour_type: 'Day Long', couple_extra_fee: 0, hotel_applicable: false }
];

export const BOOKERS: Booker[] = [
  { code: "KS101", name: "Kazi Shetu" },
  { code: "SI202", name: "Sadekul Islam" }
];

export const CUSTOMER_TYPES: CustomerType[] = [
  { type: "Standard", fee: 0 },
  { type: "Couple Room Extra", fee: 1500 },
  { type: "Solo Traveler", fee: 1500 }
];

export const generateSeatsFromLayout = (layout: BusCustomLayout = DEFAULT_BUS_LAYOUT): SeatData[] => {
  const seats: SeatData[] = [];
  const totalCols = layout.leftColumns + layout.rightColumns;

  layout.rows.forEach(row => {
    for (let i = 1; i <= totalCols; i++) {
      const seatId = `${row}${i}`;
      const isDisabled = layout.disabledSeats?.includes(seatId);
      seats.push({
        id: seatId,
        isBooked: false,
        label: layout.customLabels?.[seatId] || seatId,
        isDisabled
      });
    }
  });

  if (layout.hasRearBench && layout.rearBenchSeats > 0) {
    const rearRow = layout.rearRowLetter || 'K';
    for (let i = 1; i <= layout.rearBenchSeats; i++) {
      const seatId = `${rearRow}${i}`;
      const isDisabled = layout.disabledSeats?.includes(seatId);
      seats.push({
        id: seatId,
        isBooked: false,
        label: layout.customLabels?.[seatId] || seatId,
        isDisabled
      });
    }
  }

  return seats;
};

export const generateInitialSeats = (): SeatData[] => {
  return generateSeatsFromLayout(DEFAULT_BUS_LAYOUT);
};

export const DEFAULT_HOTELS: Hotel[] = [
  { id: 'h1', name: 'Resort RungRang (Sajek)', location: 'Sajek Valley', tourName: 'Sajek Valley', contactNumber: '01800000000', address: 'Ruilui Para, Sajek' },
  { id: 'h2', name: 'Hotel Sea Crown', location: "Cox's Bazar", tourName: "Cox's Bazar Relax", contactNumber: '01700000000', address: 'Kolatoli Road, Coxs Bazar' },
  { id: 'h3', name: 'Hotel Grand Sylhet', location: 'Sylhet', tourName: 'Sylhet Day Long', contactNumber: '01900000000', address: 'Airport Road, Sylhet' }
];

export const DEFAULT_ROOMS: HotelRoom[] = [
  { id: 'r101', hotelId: 'h1', hotelName: 'Resort RungRang (Sajek)', tourName: 'Sajek Valley', roomNo: '101', roomType: 'Couple', capacity: 2, floor: '1st Floor', assignedBookingIds: [] },
  { id: 'r102', hotelId: 'h1', hotelName: 'Resort RungRang (Sajek)', tourName: 'Sajek Valley', roomNo: '102', roomType: 'Couple', capacity: 2, floor: '1st Floor', assignedBookingIds: [] },
  { id: 'r103', hotelId: 'h1', hotelName: 'Resort RungRang (Sajek)', tourName: 'Sajek Valley', roomNo: '103', roomType: 'Combine4', capacity: 4, floor: '1st Floor', assignedBookingIds: [] },
  { id: 'r201', hotelId: 'h1', hotelName: 'Resort RungRang (Sajek)', tourName: 'Sajek Valley', roomNo: '201', roomType: 'Combine5', capacity: 5, floor: '2nd Floor', assignedBookingIds: [] },
  { id: 'r202', hotelId: 'h1', hotelName: 'Resort RungRang (Sajek)', tourName: 'Sajek Valley', roomNo: '202', roomType: 'Combine6', capacity: 6, floor: '2nd Floor', assignedBookingIds: [] },
  { id: 'r203', hotelId: 'h1', hotelName: 'Resort RungRang (Sajek)', tourName: 'Sajek Valley', roomNo: '203', roomType: 'Single', capacity: 1, floor: '2nd Floor', assignedBookingIds: [] },

  { id: 'r301', hotelId: 'h2', hotelName: 'Hotel Sea Crown', tourName: "Cox's Bazar Relax", roomNo: '301', roomType: 'Couple', capacity: 2, floor: '3rd Floor', assignedBookingIds: [] },
  { id: 'r302', hotelId: 'h2', hotelName: 'Hotel Sea Crown', tourName: "Cox's Bazar Relax", roomNo: '302', roomType: 'Couple', capacity: 2, floor: '3rd Floor', assignedBookingIds: [] },
  { id: 'r303', hotelId: 'h2', hotelName: 'Hotel Sea Crown', tourName: "Cox's Bazar Relax", roomNo: '303', roomType: 'Combine4', capacity: 4, floor: '3rd Floor', assignedBookingIds: [] },
  { id: 'r304', hotelId: 'h2', hotelName: 'Hotel Sea Crown', tourName: "Cox's Bazar Relax", roomNo: '304', roomType: 'Combine6', capacity: 6, floor: '3rd Floor', assignedBookingIds: [] }
];

