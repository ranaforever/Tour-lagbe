
import React from 'react';
import { SeatData, BusCustomLayout } from '../types';
import { DEFAULT_BUS_LAYOUT } from '../constants';
import Seat from './Seat';

interface BusLayoutProps {
  seats: SeatData[];
  selectedSeatIds?: string[];
  onSeatClick: (id: string) => void;
  onProceedBooking?: (seatIds?: string[]) => void;
  onClearSelection?: () => void;
  layoutConfig?: BusCustomLayout;
}

const BusLayout: React.FC<BusLayoutProps> = ({ 
  seats, 
  selectedSeatIds = [], 
  onSeatClick, 
  onProceedBooking,
  onClearSelection,
  layoutConfig = DEFAULT_BUS_LAYOUT 
}) => {
  const safeSelected = Array.isArray(selectedSeatIds) ? selectedSeatIds : [];
  const leftCols = layoutConfig.leftColumns || 2;
  const rightCols = layoutConfig.rightColumns || 2;
  const rows = layoutConfig.rows || ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  const hasRear = layoutConfig.hasRearBench ?? true;
  const rearRow = layoutConfig.rearRowLetter || 'K';

  const bookedCount = seats.filter(s => s.isBooked).length;
  const availableCount = seats.filter(s => !s.isBooked && !s.isDisabled).length;

  return (
    <div className="flex flex-col items-center w-full max-w-[500px]">
      {/* Bus Top Frame & Controls */}
      <div className="w-full mb-3 flex items-center justify-between px-3 text-[10px] font-black uppercase text-gray-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Available ({availableCount})</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> Booked ({bookedCount})</span>
        </div>
        {safeSelected.length > 0 && (
          <button 
            onClick={onClearSelection}
            className="text-orange-600 font-bold hover:underline flex items-center gap-1"
          >
            <i className="fas fa-times-circle"></i> Clear ({safeSelected.length})
          </button>
        )}
      </div>

      <div className="relative mx-auto w-full bg-white border-[8px] sm:border-[12px] md:border-[16px] border-[#001D4A] rounded-t-[60px] sm:rounded-t-[80px] md:rounded-t-[100px] rounded-b-[32px] md:rounded-b-[50px] p-2.5 sm:p-4 md:p-8 pt-20 sm:pt-24 md:pt-28 shadow-2xl overflow-hidden min-h-[700px] md:min-h-[820px]">
        {/* Visual Accents */}
        <div className="absolute top-0 left-0 w-full h-1 bg-[#001D4A] opacity-10"></div>
        <div className="absolute top-6 sm:top-8 md:top-12 left-1/2 -translate-x-1/2 w-24 sm:w-28 md:w-36 h-2 sm:h-2.5 bg-gray-100 rounded-full"></div>

        {/* Driver Section */}
        <div className="absolute top-5 sm:top-7 md:top-9 right-4 sm:right-6 md:right-10 text-[#001D4A]">
          <div className="w-10 h-10 sm:w-11 sm:h-11 md:w-13 md:h-13 border-[3px] border-[#001D4A] rounded-2xl flex items-center justify-center bg-gray-50 shadow-inner">
            <i className="fas fa-dharmachakra text-base sm:text-lg md:text-xl opacity-80 animate-spin-slow"></i>
          </div>
          <span className="text-[6px] sm:text-[7px] md:text-[8px] uppercase font-black tracking-[0.1em] mt-0.5 sm:mt-1 block text-center opacity-40">Pilot</span>
        </div>

        {/* Door Indicator */}
        <div className="absolute top-5 sm:top-7 md:top-9 left-4 sm:left-6 md:left-10 text-[#001D4A]">
          <div className="w-10 h-10 sm:w-11 sm:h-11 md:w-13 md:h-13 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center bg-gray-50/50">
            <i className="fas fa-door-open text-xs sm:text-sm text-gray-300"></i>
          </div>
          <span className="text-[6px] sm:text-[7px] md:text-[8px] uppercase font-black tracking-[0.1em] mt-0.5 sm:mt-1 block text-center text-gray-300">Entry</span>
        </div>

        <div className="space-y-3.5 sm:space-y-4 md:space-y-5 relative z-10">
          {/* Main Seating Rows */}
          {rows.map((row) => {
            const rowSeats = seats.filter(s => s.id.startsWith(row));
            const leftSeats = rowSeats.slice(0, leftCols);
            const rightSeats = rowSeats.slice(leftCols, leftCols + rightCols);

            return (
              <div key={row} className="flex justify-between items-center px-0.5 sm:px-1">
                {/* Left Side */}
                <div className={`flex ${leftCols === 1 ? 'gap-0' : 'gap-1.5 sm:gap-2 md:gap-4'}`}>
                  {leftSeats.map(seat => {
                    const selIndex = safeSelected.indexOf(seat.id);
                    return (
                      <Seat 
                        key={seat.id} 
                        data={seat} 
                        isSelected={selIndex !== -1}
                        selectionIndex={selIndex !== -1 ? selIndex : undefined}
                        onClick={() => onSeatClick(seat.id)} 
                      />
                    );
                  })}
                </div>

                {/* Aisle Indicator */}
                <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-9 md:h-9 flex items-center justify-center">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 rounded-full bg-gray-50 text-[9px] sm:text-[10px] md:text-[11px] font-black text-gray-300 flex items-center justify-center border border-gray-100">
                    {row}
                  </div>
                </div>

                {/* Right Side */}
                <div className={`flex ${rightCols === 1 ? 'gap-0' : 'gap-1.5 sm:gap-2 md:gap-4'}`}>
                  {rightSeats.map(seat => {
                    const selIndex = safeSelected.indexOf(seat.id);
                    return (
                      <Seat 
                        key={seat.id} 
                        data={seat} 
                        isSelected={selIndex !== -1}
                        selectionIndex={selIndex !== -1 ? selIndex : undefined}
                        onClick={() => onSeatClick(seat.id)} 
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Rear Bench */}
          {hasRear && (
            <div className="pt-5 sm:pt-6 md:pt-8 mt-3 sm:mt-4 border-t-4 border-dashed border-gray-100">
              <div className="flex justify-between gap-1 sm:gap-1.5 md:gap-2">
                {seats.filter(s => s.id.startsWith(rearRow)).map(seat => {
                  const selIndex = safeSelected.indexOf(seat.id);
                  return (
                    <Seat 
                      key={seat.id} 
                      data={seat} 
                      isSelected={selIndex !== -1}
                      selectionIndex={selIndex !== -1 ? selIndex : undefined}
                      onClick={() => onSeatClick(seat.id)} 
                    />
                  );
                })}
              </div>
              <div className="text-center mt-3 sm:mt-4 text-[7px] sm:text-[8px] md:text-[9px] font-black text-gray-300 uppercase tracking-widest">
                Rear Seating
              </div>
            </div>
          )}
        </div>
        
        {/* Texture Layer */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{backgroundImage: 'radial-gradient(#000 1px, transparent 0)', backgroundSize: '15px 15px'}}></div>
      </div>

      {/* Floating Bottom Multi-Seat Action Bar (Appears when seats are selected, safely above mobile nav) */}
      {safeSelected.length > 0 && (
        <div className="fixed sm:sticky bottom-[84px] md:bottom-6 left-3 right-3 sm:left-auto sm:right-auto z-50 w-[calc(100%-24px)] sm:w-full mt-4 animate-in slide-in-from-bottom-5 duration-300 max-w-[480px]">
          <div className="bg-[#001D4A] text-white p-3.5 sm:p-4 md:p-5 rounded-[24px] sm:rounded-[28px] shadow-2xl border border-white/20 flex items-center justify-between gap-2.5 sm:gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-orange-500 text-white font-black text-[10px] sm:text-xs flex items-center justify-center">
                  {safeSelected.length}
                </span>
                <p className="text-xs sm:text-sm font-black uppercase tracking-tight truncate">
                  {safeSelected.length === 1 ? '১টি আসন নির্বাচিত' : `${safeSelected.length}টি আসন নির্বাচিত`}
                </p>
              </div>
              <p className="text-[9px] sm:text-[10px] md:text-xs text-orange-300 font-bold tracking-widest mt-0.5 truncate">
                আসন: {safeSelected.join(', ')}
              </p>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                onClick={onClearSelection}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center text-xs sm:text-sm transition-all active:scale-95"
                title="বাতিল করুন (Clear)"
              >
                <i className="fas fa-times"></i>
              </button>
              <button
                onClick={() => onProceedBooking?.(safeSelected)}
                className="px-4 py-2.5 sm:px-5 sm:py-3 md:px-6 md:py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-2xl font-black text-xs md:text-sm uppercase tracking-wider shadow-lg shadow-orange-500/30 flex items-center gap-1.5 sm:gap-2 active:scale-95 transition-all hover:brightness-110"
              >
                <span>বুকিং</span>
                <i className="fas fa-arrow-right text-[10px] sm:text-xs animate-pulse"></i>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BusLayout;

