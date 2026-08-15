
import React, { useState, useMemo } from 'react';
import { BusData, BookingInfo, Booker } from '../types';

interface BookingLogProps {
  buses: BusData[];
  bookers: Booker[];
  isAdmin?: boolean;
}

const BookingLog: React.FC<BookingLogProps> = ({ buses, isAdmin }) => {
  const [filterTour, setFilterTour] = useState('');
  const [filterBooker, setFilterBooker] = useState('');
  const [filterDate, setFilterDate] = useState('');

  const allBookings: BookingInfo[] = useMemo(() => 
    buses.flatMap(b => b.seats.filter(s => s.isBooked).map(s => s.bookingInfo!)),
    [buses]
  );

  const filteredBookings = useMemo(() => {
    return allBookings.filter(b => {
      const matchesTour = filterTour === '' || b.tourName === filterTour;
      const matchesBooker = filterBooker === '' || b.bookedBy.toLowerCase().includes(filterBooker.toLowerCase()) || b.bookerCode.toLowerCase().includes(filterBooker.toLowerCase());
      const matchesDate = filterDate === '' || b.bookingDate.startsWith(filterDate);
      return matchesTour && matchesBooker && matchesDate;
    });
  }, [allBookings, filterTour, filterBooker, filterDate]);

  const uniqueTours = useMemo(() => Array.from(new Set(allBookings.map(b => b.tourName))), [allBookings]);

  const downloadCSV = () => {
    const headers = ['Seat', 'Name', 'Mobile', 'Tour', 'Total Fees', 'Advance', 'Due', 'Status', 'Booked By', ...(isAdmin ? ['Booker ID'] : []), 'Date'];
    const rows = filteredBookings.map(b => [
      `${b.busNo}-${b.seatNo}`,
      b.name,
      `+880${b.mobile}`,
      b.tourName,
      b.tourFees + b.customerTypeFees,
      b.advanceAmount,
      b.dueAmount,
      b.paymentStatus,
      b.bookedBy,
      ...(isAdmin ? [b.bookerCode] : []),
      new Date(b.bookingDate).toLocaleDateString()
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `TourLagbe_Report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 p-6 md:p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-black text-[#001D4A] tracking-tighter uppercase">Response Sheet</h2>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Entries: {filteredBookings.length}</p>
          </div>
          <button 
            onClick={downloadCSV}
            className="w-full md:w-auto bg-[#001D4A] text-white px-6 py-4 rounded-2xl text-xs font-black uppercase shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <i className="fas fa-file-csv text-base"></i> Export Data
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select 
            value={filterTour}
            onChange={(e) => setFilterTour(e.target.value)}
            className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-xs font-black text-[#001D4A] outline-none appearance-none"
          >
            <option value="">All Tours</option>
            {uniqueTours.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input 
            type="text"
            placeholder="Search Agent / ID"
            value={filterBooker}
            onChange={(e) => setFilterBooker(e.target.value)}
            className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-xs font-black outline-none placeholder:text-gray-300 uppercase"
          />
          <input 
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-xs font-black outline-none"
          />
        </div>
      </div>

      {/* Mobile Card List / Desktop Table */}
      <div className="md:bg-white md:rounded-[32px] md:shadow-sm md:border md:border-gray-100 md:overflow-hidden">
        {/* Desktop View Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-gray-100 text-gray-500 font-black uppercase text-[10px] tracking-widest">
                <th className="px-6 py-4">Seat</th>
                <th className="px-6 py-4">Passenger</th>
                <th className="px-6 py-4">Tour Info</th>
                <th className="px-6 py-4">Finance</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Agent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredBookings.map((b) => (
                <tr key={b.id} className="transition-colors">
                  <td className="px-6 py-4 font-black text-indigo-600">{b.seatNo}</td>
                  <td className="px-6 py-4">
                    <p className="font-bold text-gray-800">{b.name}</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">+880{b.mobile}</p>
                  </td>
                  <td className="px-6 py-4 font-black text-gray-700">{b.tourName}</td>
                  <td className="px-6 py-4">
                    <p className="font-black text-gray-800">৳{(b.tourFees + b.customerTypeFees).toLocaleString()}</p>
                    <p className="text-[10px] text-red-500 font-black">DUE: ৳{b.dueAmount.toLocaleString()}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${b.paymentStatus === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                      {b.paymentStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-black text-gray-800">{b.bookedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View Card List */}
        <div className="md:hidden space-y-3">
          {filteredBookings.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
              <p className="text-gray-400 font-black uppercase text-xs">No records found</p>
            </div>
          ) : (
            filteredBookings.map((b) => (
              <div key={b.id} className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#001D4A] rounded-xl flex items-center justify-center text-white font-black text-sm">{b.seatNo}</div>
                    <div>
                      <p className="font-black text-[#001D4A] leading-none">{b.name}</p>
                      <p className="text-[9px] text-gray-400 font-bold uppercase mt-1 tracking-tight">+880{b.mobile}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${b.paymentStatus === 'Paid' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>
                    {b.paymentStatus}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 border-t border-gray-50 pt-4">
                  <div>
                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Tour Identity</p>
                    <p className="text-[10px] font-black text-gray-700 truncate">{b.tourName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Financials</p>
                    <p className="text-[10px] font-black text-gray-900 leading-none">৳{(b.tourFees + b.customerTypeFees).toLocaleString()}</p>
                    <p className="text-[9px] font-black text-red-500 mt-0.5">DUE: ৳{b.dueAmount}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Booking Agent</p>
                    <p className="text-[10px] font-black text-indigo-600 uppercase">{b.bookedBy}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Date Entered</p>
                    <p className="text-[10px] font-black text-gray-500">{new Date(b.bookingDate).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default BookingLog;
