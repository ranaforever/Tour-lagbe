
import React, { useState, useMemo } from 'react';
import { BusData, BookingInfo, Expense, Tour } from '../types';

interface RevenueReportProps {
  buses: BusData[];
  expenses: Expense[];
  tours: Tour[];
  isAdmin?: boolean;
  onClearExpenses?: () => void;
}

const RevenueReport: React.FC<RevenueReportProps> = ({ buses, expenses, tours, isAdmin, onClearExpenses }) => {
  const [filterTour, setFilterTour] = useState('');

  const filteredBookings: BookingInfo[] = useMemo(() => {
    const all = buses.flatMap(b => b.seats.filter(s => s.isBooked).map(s => s.bookingInfo!));
    if (!filterTour) return all;
    return all.filter(b => b.tourName === filterTour);
  }, [buses, filterTour]);

  const filteredExpenses: Expense[] = useMemo(() => {
    if (!filterTour) return expenses;
    return expenses.filter(ex => ex.tourName === filterTour);
  }, [expenses, filterTour]);

  const totalSales = filteredBookings.reduce((sum, b) => sum + (b.tourFees + b.customerTypeFees - b.discountAmount), 0);
  const totalCashCollected = filteredBookings.reduce((sum, b) => sum + b.advanceAmount, 0);
  const totalExpenses = filteredExpenses.reduce((sum, ex) => sum + ex.amount, 0);
  const grossProfit = totalSales - totalExpenses;
  const netCashBalance = totalCashCollected - totalExpenses;

  const revenueByTour = useMemo(() => {
    const cats: Record<string, number> = {};
    const all = buses.flatMap(b => b.seats.filter(s => s.isBooked).map(s => s.bookingInfo!));
    all.forEach(b => {
      cats[b.tourName] = (cats[b.tourName] || 0) + (b.tourFees + b.customerTypeFees - b.discountAmount);
    });
    return Object.entries(cats).sort((a,b) => b[1] - a[1]);
  }, [buses]);

  const revenueByBooker = useMemo(() => {
    const bookers: Record<string, { name: string, amount: number }> = {};
    filteredBookings.forEach(b => {
      if (!bookers[b.bookerCode]) {
        bookers[b.bookerCode] = { name: b.bookedBy, amount: 0 };
      }
      bookers[b.bookerCode].amount += (b.tourFees + b.customerTypeFees - b.discountAmount);
    });
    return Object.entries(bookers).sort((a, b) => b[1].amount - a[1].amount);
  }, [filteredBookings]);

  const expenseByCategory = useMemo(() => {
    const cats: Record<string, number> = {};
    filteredExpenses.forEach(ex => {
      cats[ex.category] = (cats[ex.category] || 0) + ex.amount;
    });
    return Object.entries(cats).sort((a,b) => b[1] - a[1]);
  }, [filteredExpenses]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl mx-auto md:pl-12 pb-20">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
        <div>
          <h2 className="text-3xl font-black text-[#001D4A] tracking-tighter">Finance Hub</h2>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Live Financial Overview</p>
        </div>
        
        {/* Global Filter Bar */}
        <div className="bg-white p-2 rounded-2xl shadow-sm border flex items-center gap-3 w-full md:w-auto">
           <span className="text-[10px] font-black uppercase text-gray-300 pl-4 border-r pr-4">Filter View:</span>
           <select 
              value={filterTour} 
              onChange={e => setFilterTour(e.target.value)}
              className="bg-transparent font-black text-[#001D4A] outline-none text-sm pr-6 cursor-pointer appearance-none min-w-[150px]"
           >
              <option value="">All Business Data</option>
              {tours.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
           </select>
           <i className="fas fa-chevron-down text-indigo-200 text-xs mr-2 pointer-events-none"></i>
        </div>
      </div>

      {/* Main KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 relative overflow-hidden group transition-all">
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-full -mr-10 -mt-10 opacity-40 transition-transform"></div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 relative z-10">Total Revenue</p>
            <h4 className="text-3xl font-black text-green-600 relative z-10">৳{totalSales.toLocaleString()}</h4>
            <div className="mt-4 flex items-center gap-2 relative z-10">
               <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
               <span className="text-[9px] font-bold text-gray-400 uppercase">{filterTour ? 'Route Billing' : 'Gross Billing'}</span>
            </div>
         </div>

         <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 relative overflow-hidden group transition-all">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-full -mr-10 -mt-10 opacity-40 transition-transform"></div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 relative z-10">Total Costs</p>
            <h4 className="text-3xl font-black text-red-600 relative z-10">৳{totalExpenses.toLocaleString()}</h4>
            <div className="mt-4 flex items-center gap-2 relative z-10">
               <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
               <span className="text-[9px] font-bold text-gray-400 uppercase">Operational Expenses</span>
            </div>
         </div>

         <div className="bg-[#001D4A] p-8 rounded-[40px] shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 transition-transform"></div>
            <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-1 relative z-10">Net Profit</p>
            <h4 className={`text-3xl font-black relative z-10 ${grossProfit >= 0 ? 'text-white' : 'text-red-400'}`}>
               ৳{grossProfit.toLocaleString()}
            </h4>
            <div className="mt-4 flex items-center gap-2 relative z-10">
               <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></span>
               <span className="text-[9px] font-bold text-indigo-300/60 uppercase">After Collections</span>
            </div>
         </div>

         <div className="bg-orange-500 p-8 rounded-[40px] shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 transition-transform"></div>
            <p className="text-[10px] font-black text-white uppercase tracking-widest mb-1 relative z-10">Cash In-Hand</p>
            <h4 className="text-3xl font-black text-white relative z-10">৳{netCashBalance.toLocaleString()}</h4>
            <div className="mt-4 flex items-center gap-2 relative z-10">
               <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
               <span className="text-[9px] font-bold text-white/60 uppercase">Current Balance</span>
            </div>
         </div>
      </div>

      {/* Breakdowns Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         {/* Tour Wise Revenue */}
         <div className="bg-white p-8 md:p-10 rounded-[40px] shadow-xl border border-gray-100">
            <h3 className="text-xl font-black text-[#001D4A] uppercase tracking-tighter mb-8 flex items-center gap-3">
               <i className="fas fa-route text-indigo-500"></i> Tour Wise Distribution
            </h3>
            <div className="space-y-6">
               {revenueByTour.map(([cat, val]) => (
                  <div key={cat} className={`group ${filterTour && filterTour !== cat ? 'opacity-20 grayscale' : ''}`}>
                     <div className="flex justify-between text-[11px] font-black mb-2 uppercase tracking-widest">
                        <span className="text-gray-500 transition-colors">{cat}</span>
                        <span className="text-indigo-600">৳{val.toLocaleString()}</span>
                     </div>
                     <div className="w-full bg-gray-50 h-2 rounded-full overflow-hidden border border-gray-100">
                        <div className="bg-indigo-600 h-full transition-all duration-700" style={{ width: `${(val/totalSales)*100}%` }}></div>
                     </div>
                  </div>
               ))}
               {revenueByTour.length === 0 && <p className="text-center py-10 text-gray-300 italic font-bold">No tour revenue recorded.</p>}
            </div>
         </div>

         {/* Booker Wise Revenue */}
         <div className="bg-white p-8 md:p-10 rounded-[40px] shadow-xl border border-gray-100">
            <h3 className="text-xl font-black text-[#001D4A] uppercase tracking-tighter mb-8 flex items-center gap-3">
               <i className="fas fa-user-tie text-blue-500"></i> Agent Performance
            </h3>
            <div className="space-y-6">
               {revenueByBooker.map(([code, data]) => (
                  <div key={code} className="group">
                     <div className="flex justify-between text-[11px] font-black mb-2 uppercase tracking-widest">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-800">{data.name}</span>
                        </div>
                        <span className="text-blue-600">৳{data.amount.toLocaleString()}</span>
                     </div>
                     <div className="w-full bg-gray-50 h-2 rounded-full overflow-hidden border border-gray-100">
                        <div className="bg-blue-500 h-full transition-all duration-700" style={{ width: `${(data.amount/totalSales)*100}%` }}></div>
                     </div>
                  </div>
               ))}
               {revenueByBooker.length === 0 && <p className="text-center py-10 text-gray-300 italic font-bold">No agent data for selected view.</p>}
            </div>
         </div>

          {/* Expense Breakdown */}
          <div className="lg:col-span-2 bg-white p-8 md:p-10 rounded-[40px] shadow-xl border border-gray-100">
             <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                  <h3 className="text-xl font-black text-[#001D4A] uppercase tracking-tighter flex items-center gap-3">
                     <i className="fas fa-chart-area text-red-500"></i> Cost Distribution {filterTour && `for ${filterTour}`}
                  </h3>
                  {isAdmin && onClearExpenses && (
                    <button 
                      onClick={onClearExpenses}
                      className="text-[9px] font-black text-red-500 bg-red-50 px-3 py-1 rounded-lg uppercase transition-all"
                    >
                      Clear All Data
                    </button>
                  )}
                </div>
                <span className="text-xs font-black text-red-500 bg-red-50 px-4 py-1 rounded-full uppercase">Total Category Costs: ৳{totalExpenses.toLocaleString()}</span>
             </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
               {expenseByCategory.map(([cat, val]) => (
                  <div key={cat} className="group">
                     <div className="flex justify-between text-[11px] font-black mb-2 uppercase tracking-widest">
                        <span className="text-gray-500 transition-colors">{cat}</span>
                        <span className="text-red-600">৳{val.toLocaleString()}</span>
                     </div>
                     <div className="w-full bg-gray-50 h-2 rounded-full overflow-hidden border border-gray-100">
                        <div className="bg-red-500 h-full transition-all duration-700" style={{ width: `${(val/totalExpenses)*100}%` }}></div>
                     </div>
                  </div>
               ))}
               {expenseByCategory.length === 0 && <div className="col-span-2 text-center py-10 text-gray-300 italic font-bold">No expense records found for this selection.</div>}
            </div>
         </div>
      </div>
    </div>
  );
};

export default RevenueReport;
