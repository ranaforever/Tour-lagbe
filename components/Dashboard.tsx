
import React, { useMemo, useState } from 'react';
import { BusData, BookingInfo, Expense } from '../types';

interface DashboardProps {
  buses: BusData[];
  expenses: Expense[];
  notify?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const Dashboard: React.FC<DashboardProps> = ({ buses, expenses, notify }) => {
  const [selectedAgent, setSelectedAgent] = useState<{name: string, bookings: BookingInfo[]} | null>(null);
  const [modalFilter, setModalFilter] = useState('');

  const allBookings: BookingInfo[] = useMemo(() => 
    buses.flatMap(b => b.seats.filter(s => s.isBooked).map(s => s.bookingInfo!)),
    [buses]
  );
  
  const handleAgentClick = (name: string) => {
    const agentBookings = allBookings.filter(b => b.bookedBy.trim().toUpperCase() === name.toUpperCase());
    setSelectedAgent({ name, bookings: agentBookings });
  };
  
  const totalRevenue = allBookings.reduce((sum, b) => sum + (b.tourFees + b.customerTypeFees - b.discountAmount), 0);
  const totalDue = allBookings.reduce((sum, b) => sum + b.dueAmount, 0);
  const totalExpenses = expenses.reduce((sum, ex) => sum + ex.amount, 0);
  const netProfit = totalRevenue - totalExpenses;

  const agentStats = useMemo(() => {
    const stats: Record<string, { 
      name: string, 
      seats: number, 
      revenue: number, 
      discount: number, 
      due: number,
      lastSeen: string,
      codes: Set<string>
    }> = {};

    allBookings.forEach(b => {
      const normalizedName = b.bookedBy.trim();
      const key = normalizedName.toUpperCase();
      
      if (!stats[key]) {
        stats[key] = { 
          name: normalizedName, 
          seats: 0, 
          revenue: 0, 
          discount: 0, 
          due: 0,
          lastSeen: b.bookingDate,
          codes: new Set()
        };
      }
      
      stats[key].seats += 1;
      stats[key].revenue += (b.tourFees + b.customerTypeFees - b.discountAmount);
      stats[key].discount += b.discountAmount;
      stats[key].due += b.dueAmount;
      stats[key].codes.add(b.bookerCode);
      
      if (new Date(b.bookingDate) > new Date(stats[key].lastSeen)) {
        stats[key].lastSeen = b.bookingDate;
      }
    });

    const list = Object.values(stats).map(s => ({
      ...s,
      codes: Array.from(s.codes).join(', ')
    }));

    return {
      byBookings: [...list].sort((a, b) => b.seats - a.seats),
      byDiscount: [...list].sort((a, b) => b.discount - a.discount),
      byDue: [...list].sort((a, b) => b.due - a.due),
    };
  }, [allBookings]);

  const stats = [
    { label: 'Fleet Capacity', value: buses.reduce((acc, b) => acc + b.seats.length, 0), icon: 'fa-chair', color: 'bg-indigo-600' },
    { label: 'Confirmed Seats', value: allBookings.length, icon: 'fa-check-double', color: 'bg-green-500' },
    { label: 'Projected Sales', value: `৳${totalRevenue.toLocaleString()}`, icon: 'fa-sack-dollar', color: 'bg-blue-500' },
    { label: 'Total Due', value: `৳${totalDue.toLocaleString()}`, icon: 'fa-hand-holding-dollar', color: 'bg-orange-500' },
    { label: 'Projected Profit', value: `৳${netProfit.toLocaleString()}`, icon: 'fa-chart-pie', color: 'bg-[#001D4A]' },
  ];

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500 max-w-6xl mx-auto md:pl-12 pb-20">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-4 md:p-5 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between transition-all group">
            <div className={`${stat.color} w-10 h-10 md:w-11 md:h-11 rounded-2xl flex items-center justify-center text-white text-base md:text-lg shadow-lg mb-3 md:mb-4 transition-transform`}>
               <i className={`fas ${stat.icon}`}></i>
            </div>
            <div>
              <p className="text-[8px] md:text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">{stat.label}</p>
              <h4 className="text-sm md:text-xl font-black text-[#001D4A]">{stat.value}</h4>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-12 bg-white p-6 md:p-8 rounded-[32px] shadow-sm border border-gray-100">
          <h3 className="text-xl font-black text-[#001D4A] mb-8 flex items-center gap-3">
            <div className="w-2 h-6 bg-indigo-500 rounded-full"></div>
            Route Occupancy
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
             {buses.length > 0 ? buses.map(bus => {
               const bookedCount = bus.seats.filter(s => s.isBooked).length;
               const percent = Math.round((bookedCount / bus.seats.length) * 100);
               return (
                 <div key={bus.busId} className="group">
                    <div className="flex justify-between text-[11px] font-black mb-2 uppercase">
                      <span className="text-gray-600 transition-colors tracking-wider">{bus.busId}</span>
                      <span className="text-indigo-600">{bookedCount}/{bus.seats.length} ({percent}%)</span>
                    </div>
                    <div className="w-full bg-gray-50 h-3 rounded-full overflow-hidden border border-gray-100">
                       <div className="bg-indigo-600 h-full transition-all duration-1000 shadow-sm" style={{ width: `${percent}%` }}></div>
                    </div>
                 </div>
               )
             }) : (
               <p className="text-center text-gray-400 py-10 italic col-span-2">No active tours to display.</p>
             )}
          </div>
        </div>

        {/* Leaderboards Section */}
        <div className="lg:col-span-4 space-y-6">
           <div className="bg-[#001D4A] p-6 md:p-8 rounded-[32px] text-white shadow-2xl overflow-hidden relative h-full">
              <i className="fas fa-trophy absolute top-[-20px] right-[-20px] text-white/5 text-[150px] rotate-12"></i>
              <h3 className="text-xl font-black mb-6 flex items-center gap-3 relative z-10">
                <i className="fas fa-medal text-orange-400"></i>
                Booking Leaders
              </h3>
              <div className="space-y-4 relative z-10 max-h-[500px] overflow-y-auto no-scrollbar">
                {agentStats.byBookings.length > 0 ? agentStats.byBookings.map((agent, idx) => (
                  <div key={agent.name} onClick={() => handleAgentClick(agent.name)} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl transition-colors border border-white/5 cursor-pointer hover:bg-white/10">
                    <div className="flex items-center gap-4">
                       <div className="relative">
                         <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${idx === 0 ? 'bg-orange-500' : 'bg-white/10'}`}>
                           {idx + 1}
                         </span>
                       </div>
                       <div>
                         <p className="text-sm font-bold truncate max-w-[120px]">{agent.name}</p>
                         <p className="text-[8px] text-white/30 font-bold uppercase">{agent.seats} Seats • ৳{agent.revenue.toLocaleString()}</p>
                       </div>
                    </div>
                    <div className="text-right">
                       <p className="text-xs font-black text-orange-400">{agent.seats}</p>
                    </div>
                  </div>
                )) : (
                  <p className="text-center text-white/30 py-10 italic">No activities found.</p>
                )}
              </div>
           </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
           <div className="bg-white p-6 md:p-8 rounded-[32px] shadow-sm border border-gray-100 h-full">
              <h3 className="text-xl font-black text-[#001D4A] mb-6 flex items-center gap-3">
                <i className="fas fa-percent text-red-500"></i>
                Most Discount
              </h3>
              <div className="space-y-4 max-h-[500px] overflow-y-auto no-scrollbar">
                {agentStats.byDiscount.length > 0 ? agentStats.byDiscount.filter(a => a.discount > 0).map((agent, idx) => (
                  <div key={agent.name} onClick={() => handleAgentClick(agent.name)} className="flex items-center justify-between p-4 bg-red-50/50 rounded-2xl border border-red-100 cursor-pointer hover:bg-red-100/50">
                    <div className="flex items-center gap-4">
                       <span className="text-xs font-black text-red-400">#{idx + 1}</span>
                       <div>
                         <p className="text-sm font-bold text-[#001D4A] truncate max-w-[120px]">{agent.name}</p>
                         <p className="text-[8px] text-gray-400 font-bold uppercase">{agent.seats} Bookings</p>
                       </div>
                    </div>
                    <div className="text-right">
                       <p className="text-xs font-black text-red-600">৳{agent.discount.toLocaleString()}</p>
                    </div>
                  </div>
                )) : (
                  <p className="text-center text-gray-300 py-10 italic">No discounts given yet.</p>
                )}
              </div>
           </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
           <div className="bg-white p-6 md:p-8 rounded-[32px] shadow-sm border border-gray-100 h-full">
              <h3 className="text-xl font-black text-[#001D4A] mb-6 flex items-center gap-3">
                <i className="fas fa-clock text-orange-500"></i>
                Most Due List
              </h3>
              <div className="space-y-4 max-h-[500px] overflow-y-auto no-scrollbar">
                {agentStats.byDue.length > 0 ? agentStats.byDue.filter(a => a.due > 0).map((agent, idx) => (
                  <div key={agent.name} onClick={() => handleAgentClick(agent.name)} className="flex items-center justify-between p-4 bg-orange-50/50 rounded-2xl border border-orange-100 cursor-pointer hover:bg-orange-100/50">
                    <div className="flex items-center gap-4">
                       <span className="text-xs font-black text-orange-400">#{idx + 1}</span>
                       <div>
                         <p className="text-sm font-bold text-[#001D4A] truncate max-w-[120px]">{agent.name}</p>
                         <p className="text-[8px] text-gray-400 font-bold uppercase">{agent.seats} Bookings</p>
                       </div>
                    </div>
                    <div className="text-right">
                       <p className="text-xs font-black text-orange-600">৳{agent.due.toLocaleString()}</p>
                    </div>
                  </div>
                )) : (
                  <p className="text-center text-gray-300 py-10 italic">No pending dues.</p>
                )}
              </div>
           </div>
        </div>
      </div>

      {selectedAgent && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-[#001D4A]/80 backdrop-blur-md">
          <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-[#001D4A] p-6 text-white flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight">{selectedAgent.name}'s Bookings</h3>
                <p className="text-orange-400 text-[10px] uppercase font-black tracking-widest mt-1">
                  Total: {selectedAgent.bookings.filter(b => modalFilter === '' || b.tourName === modalFilter).length} Seats
                </p>
              </div>
              <button onClick={() => { setSelectedAgent(null); setModalFilter(''); }} className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center"><i className="fas fa-times"></i></button>
            </div>
            
            <div className="px-6 pt-4">
               <select 
                 value={modalFilter}
                 onChange={(e) => setModalFilter(e.target.value)}
                 className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3 text-[10px] font-black text-[#001D4A] outline-none appearance-none uppercase tracking-widest"
               >
                 <option value="">All Tours / Buses</option>
                 {Array.from(new Set(selectedAgent.bookings.map(b => b.tourName))).map(t => (
                   <option key={t} value={t}>{t}</option>
                 ))}
               </select>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar">
              <div className="space-y-3">
                {selectedAgent.bookings
                  .filter(b => modalFilter === '' || b.tourName === modalFilter)
                  .map((b, i) => (
                  <div key={i} className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex justify-between items-center">
                    <div>
                      <p className="font-black text-[#001D4A] text-base leading-tight">{b.name}</p>
                      <p className="text-[10px] font-bold text-indigo-600 uppercase mt-0.5 flex items-center gap-2">
                        Seat: {b.seatNo} • <span className="text-gray-400">+880{b.mobile}</span>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(`+880${b.mobile}`);
                            notify?.('Number copied!', 'success');
                          }}
                          className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-100 transition-colors"
                          title="Copy Number"
                        >
                          <i className="fas fa-copy text-[10px]"></i>
                        </button>
                      </p>
                      <p className="text-[8px] font-black text-gray-400 uppercase tracking-tighter mt-1 italic">
                        {b.tourName}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-indigo-600 text-sm">৳{(b.tourFees + b.customerTypeFees - b.discountAmount).toLocaleString()}</p>
                      <p className={`text-[9px] font-black uppercase ${b.dueAmount > 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {b.dueAmount > 0 ? `Due: ৳${b.dueAmount}` : 'Fully Paid'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
