
import React, { useState, useMemo } from 'react';
import { BusData, BookingInfo, Booker } from '../types';

interface EditDataProps {
  buses: BusData[];
  onUpdate: (info: BookingInfo) => void;
  onDelete: (busId: string, seatId: string) => void;
  onBulkDelete?: (ids: string[]) => void;
  onEdit: (info: BookingInfo) => void;
  bookers: Booker[];
  isAdmin?: boolean;
  currentAgentCode?: string;
  notify?: (msg: string, type: 'success' | 'error' | 'info') => void;
  requestConfirm?: (msg: string, action: () => void) => void;
}

const EditData: React.FC<EditDataProps> = ({ buses, onDelete, onBulkDelete, onEdit, bookers, isAdmin, currentAgentCode, notify, requestConfirm }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTour, setFilterTour] = useState('');
  const [filterBooker, setFilterBooker] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const allBookings: BookingInfo[] = useMemo(() => {
    const raw = buses.flatMap(b => b.seats.filter(s => s.isBooked).map(s => s.bookingInfo!));
    if (isAdmin) return raw;
    return raw.filter(b => b.bookerCode.toUpperCase() === currentAgentCode?.toUpperCase());
  }, [buses, isAdmin, currentAgentCode]);

  const filtered = useMemo(() => {
    return allBookings.filter(b => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = searchQuery === '' || 
        b.name.toLowerCase().includes(q) || 
        b.mobile.includes(searchQuery) ||
        b.seatNo.toLowerCase().includes(q) ||
        b.bookerCode.toLowerCase().includes(q);
      
      const matchesTour = filterTour === '' || b.busNo === filterTour;
      const matchesBooker = filterBooker === '' || b.bookerCode === filterBooker;

      return matchesSearch && matchesTour && matchesBooker;
    });
  }, [allBookings, searchQuery, filterTour, filterBooker]);

  const uniqueTours = useMemo(() => Array.from(new Set(allBookings.map(b => b.busNo))), [allBookings]);

  const handleSelectAll = () => {
    if (selectedIds.length === filtered.length && filtered.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map(b => b.id));
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const handleDeleteSelected = () => {
    if (!isAdmin) return;
    if (selectedIds.length === 0) return;
    if (requestConfirm) {
      requestConfirm(`Admin Action: Permanently delete ${selectedIds.length} bookings?`, () => {
        onBulkDelete?.(selectedIds);
        setSelectedIds([]);
        notify?.("Bulk deletion successful.", 'success');
      });
    } else if (window.confirm(`Admin Action: Permanently delete ${selectedIds.length} bookings?`)) {
      onBulkDelete?.(selectedIds);
      setSelectedIds([]);
    }
  };

  const handleDeleteSingle = (booking: BookingInfo) => {
    if (!isAdmin) return;
    if (requestConfirm) {
      requestConfirm(`Admin Action: Delete booking for ${booking.name}?`, () => {
        onDelete(booking.busNo, booking.seatNo);
        notify?.("Booking removed.", 'success');
      });
    } else if (window.confirm(`Admin Action: Delete booking for ${booking.name}?`)) {
      onDelete(booking.busNo, booking.seatNo);
    }
  };

  return (
    <div className="animate-in fade-in duration-500 max-w-6xl mx-auto md:pl-12 space-y-6">
       <div className="bg-white rounded-[32px] shadow-sm p-6 md:p-8 border border-gray-100 sticky top-0 md:relative z-30">
          <div className="relative group mb-6">
            <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-gray-300"></i>
            <input 
              className="w-full pl-14 pr-6 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold outline-none shadow-inner" 
              placeholder="Search Passenger, Seat or Mobile..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
             <select 
               value={filterTour}
               onChange={(e) => setFilterTour(e.target.value)}
               className="w-full px-4 py-3 bg-indigo-50 border-none rounded-xl font-black text-indigo-600 text-[10px] uppercase outline-none"
             >
               <option value="">All Tours</option>
               {uniqueTours.map(t => <option key={t} value={t}>{t}</option>)}
             </select>
             <select 
               value={filterBooker}
               onChange={(e) => setFilterBooker(e.target.value)}
               className="w-full px-4 py-3 bg-indigo-50 border-none rounded-xl font-black text-indigo-600 text-[10px] uppercase outline-none"
             >
               <option value="">{isAdmin ? 'All Agents' : 'My Bookings'}</option>
               {bookers.filter(a => isAdmin || a.code.toUpperCase() === currentAgentCode?.toUpperCase()).map(agent => (
                 <option key={agent.code} value={agent.code}>{agent.name}</option>
               ))}
             </select>
             
             {isAdmin && (
               <div className="flex gap-2">
                 <button 
                   onClick={handleSelectAll}
                   className="flex-1 px-4 py-3 bg-[#001D4A] text-white rounded-xl font-black text-[10px] uppercase"
                 >
                   {selectedIds.length === filtered.length && filtered.length > 0 ? 'Deselect All' : 'Select All'}
                 </button>
                 <button 
                   onClick={handleDeleteSelected}
                   disabled={selectedIds.length === 0}
                   className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-black text-[10px] uppercase disabled:opacity-50"
                 >
                   Delete ({selectedIds.length})
                 </button>
               </div>
             )}
          </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
          {filtered.length === 0 ? (
            <div className="col-span-full py-20 text-center bg-white rounded-[32px] border-2 border-dashed border-gray-100">
              <i className="fas fa-search text-gray-200 text-4xl mb-4"></i>
              <p className="text-gray-400 font-black uppercase text-[10px] tracking-widest">No matching records</p>
            </div>
          ) : (
            filtered.map(booking => (
              <div 
                key={booking.id} 
                className={`bg-white p-5 rounded-[32px] shadow-sm border transition-all flex flex-col justify-between group relative ${selectedIds.includes(booking.id) ? 'border-indigo-600 ring-2 ring-indigo-50' : 'border-gray-100'}`}
              >
                 {isAdmin && (
                   <div className="absolute top-4 right-4 z-10">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(booking.id)}
                        onChange={() => toggleSelection(booking.id)}
                        className="w-6 h-6 rounded-lg border-gray-200 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                   </div>
                 )}
                 
                 <div className="flex justify-between items-start mb-4">
                    <div className="flex-1 min-w-0">
                       <div className="flex items-center gap-2 mb-2">
                          <span className="text-[8px] font-black text-white bg-[#001D4A] px-2 py-1 rounded-lg uppercase">{booking.busNo}</span>
                          <span className="text-[8px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg uppercase">Seat {booking.seatNo}</span>
                       </div>
                       <h4 className="font-black text-[#001D4A] text-lg leading-tight truncate pr-8">{booking.name}</h4>
                       <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-tighter tracking-widest">+880{booking.mobile}</p>
                    </div>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-50">
                    <div className="bg-green-50 p-3 rounded-2xl">
                       <span className="text-[8px] font-black text-green-400 uppercase tracking-widest block mb-0.5">Paid</span>
                       <span className="text-sm font-black text-green-700">৳{booking.advanceAmount.toLocaleString()}</span>
                    </div>
                    <div className="bg-red-50 p-3 rounded-2xl">
                       <span className="text-[8px] font-black text-red-400 uppercase tracking-widest block mb-0.5">Due</span>
                       <span className="text-sm font-black text-red-700">৳{booking.dueAmount.toLocaleString()}</span>
                    </div>
                 </div>

                 <div className="flex gap-2 mt-4 pt-4 border-t border-gray-50">
                   <button 
                     onClick={() => onEdit(booking)}
                     className="flex-1 py-3 bg-indigo-50 text-indigo-600 rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm"
                   >
                     <i className="fas fa-edit"></i> Edit
                   </button>
                   {isAdmin && (
                     <button 
                       onClick={() => handleDeleteSingle(booking)}
                       className="flex-1 py-3 bg-red-50 text-red-500 rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm"
                     >
                       <i className="fas fa-trash-alt"></i> Delete
                     </button>
                   )}
                 </div>

                 <div className="mt-4 flex justify-between items-center text-[8px] font-black text-gray-400 uppercase tracking-widest border-t border-gray-50 pt-3">
                    <span className="truncate max-w-[100px]">{booking.bookedBy}</span>
                    <span>{new Date(booking.bookingDate).toLocaleDateString()}</span>
                 </div>
              </div>
            ))
          )}
       </div>
    </div>
  );
};

export default EditData;
