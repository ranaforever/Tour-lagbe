
import React from 'react';
import { SeatData, Gender, Religion } from '../types';

interface SeatProps {
  data: SeatData;
  isSelected?: boolean;
  selectionIndex?: number;
  onClick: () => void;
}

const Seat: React.FC<SeatProps> = ({ data, isSelected = false, selectionIndex, onClick }) => {
  if (data.isDisabled) {
    return (
      <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-[10px] sm:rounded-[12px] md:rounded-2xl border-2 border-dashed border-gray-200/50 bg-gray-50/30 flex items-center justify-center pointer-events-none opacity-30">
        <span className="text-[9px] text-gray-300 font-bold">--</span>
      </div>
    );
  }

  const getSeatColor = () => {
    // Priority 1: Multi-selection Active (Selected by user now)
    if (isSelected) {
      return 'bg-gradient-to-br from-amber-500 to-orange-600 text-white ring-4 ring-orange-400/50 shadow-xl shadow-orange-500/40 scale-105 z-20';
    }

    // Priority 2: Temporary Lock (Gray Pulse)
    if (data.lockInfo) return 'bg-gray-400 shadow-gray-200 animate-pulse cursor-not-allowed text-white';
    
    // Priority 3: Confirmed Booking
    if (data.isBooked && data.bookingInfo) {
      const info = data.bookingInfo;
      const isFemale = info.gender === Gender.FEMALE;
      const isMuslim = info.religion === Religion.MUSLIM;

      if (isFemale && !isMuslim) return 'bg-yellow-500 shadow-yellow-200 text-white';
      if (isFemale) return 'bg-pink-500 shadow-pink-200 text-white';
      if (!isMuslim) return 'bg-blue-500 shadow-blue-200 text-white';
      return 'bg-red-500 shadow-red-200 text-white';
    }
    
    // Priority 4: Available
    return 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200 text-white hover:scale-105';
  };

  const displayName = data.label || data.id;

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className={`${getSeatColor()} w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-[10px] sm:rounded-[12px] md:rounded-2xl flex flex-col items-center justify-center text-[10px] sm:text-[11px] md:text-[13px] font-black transition-all duration-200 shadow-md md:shadow-lg transform active:scale-95 relative`}
        title={data.isBooked ? `Booked: ${data.bookingInfo?.name || ''} (${data.id})` : `Seat ${data.id}`}
      >
        <span>{displayName}</span>
        {isSelected && typeof selectionIndex === 'number' && (
          <span className="absolute -top-1.5 -right-1.5 w-4 h-4 md:w-5 md:h-5 bg-white text-orange-600 rounded-full text-[8px] sm:text-[9px] md:text-[10px] font-black flex items-center justify-center shadow-md border border-orange-200">
            {selectionIndex + 1}
          </span>
        )}
      </button>
    </div>
  );
};

export default Seat;

