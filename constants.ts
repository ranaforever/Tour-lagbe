
import { SeatData, Tour, Booker, CustomerType, BusCustomLayout, Hotel, HotelRoom } from './types';

export const BUSINESS_INFO = {
  name: "Tour লাগবে.",
  phone: "+8801303599936",
  email: "tourlagbee@gmail.com",
  website: "https://www.tourlagbe.online/",
  motto: "আপনার বিশ্বস্ত ভ্রমণ সঙ্গী",
  logo: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 85" width="280" height="85"><defs><style>@import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@700;800;900&amp;family=Playfair+Display:ital,wght@1,700;1,900&amp;family=Inter:wght@700;800&amp;display=swap');.t-tour{font-family:'Playfair Display',Georgia,serif;font-style:italic;font-weight:900;font-size:32px;fill:%23dc2626;}.t-lagbe{font-family:'Hind Siliguri',sans-serif;font-weight:900;font-size:32px;fill:%230088cc;}.t-sub{font-family:'Inter',sans-serif;font-weight:700;font-size:10.5px;fill:%230f172a;}</style></defs><text x="2" y="30" class="t-tour">Tour </text><text x="80" y="30" class="t-lagbe">লাগবে.</text><g transform="translate(2,42)"><circle cx="5.5" cy="5.5" r="5" fill="%23dc2626"/><path d="M4.5 4.5C4.5 4.5 4.8 5.6 5.8 6.6C6.8 7.6 7.9 7.9 7.9 7.9L8.6 7.2C8.8 7 9.1 7 9.3 7.1L10.2 7.7C10.4 7.8 10.5 8.1 10.4 8.3L9.8 9.1C9.7 9.3 9.4 9.4 9.1 9.4C7.9 9.1 6.4 8.3 5.3 7.1C4.2 5.9 3.5 4.5 3.3 3.3C3.2 3 3.4 2.7 3.6 2.6L4.4 2C4.6 1.9 4.9 2 5 2.2L5.6 3.1C5.7 3.3 5.7 3.6 5.5 3.8L4.5 4.5Z" fill="%23ffffff" transform="scale(0.8) translate(0.5,0.5)"/><text x="15" y="9.5" class="t-sub">+8801303599936</text></g><g transform="translate(2,56)"><rect x="0.5" y="1" width="11" height="8.5" rx="1.5" fill="none" stroke="%23dc2626" stroke-width="1.3"/><path d="M1 2L6 5.5L11 2" fill="none" stroke="%23dc2626" stroke-width="1.3"/><text x="15" y="8.5" class="t-sub">tourlagbee@gmail.com</text></g><g transform="translate(2,70)"><circle cx="6" cy="5" r="5" fill="none" stroke="%23dc2626" stroke-width="1.2"/><ellipse cx="6" cy="5" rx="2.5" ry="5" fill="none" stroke="%23dc2626" stroke-width="1"/><line x1="1" y1="5" x2="11" y2="5" stroke="%23dc2626" stroke-width="1"/><text x="15" y="8.5" class="t-sub">https://www.tourlagbe.online/</text></g><g transform="translate(245,12)"><rect x="0" y="0" width="20" height="20" fill="%230097a7"/><rect x="0" y="20" width="20" height="20" fill="%23dc2626"/><rect x="0" y="40" width="20" height="20" fill="%23f57c00"/></g></svg>`,
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

