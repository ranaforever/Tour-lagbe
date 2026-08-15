import React, { useState, useMemo } from 'react';
import { BusData, BookingInfo, Booker } from '../types';
import { GroupedBookingBilling, DueCollectionModal } from './DueCollectionModal';

interface EditDataProps {
  buses: BusData[];
  onUpdate: (info: BookingInfo) => void;
  onDelete: (busId: string, seatId: string) => void;
  onBulkDelete?: (ids: string[]) => void;
  onEdit: (info: BookingInfo) => void;
  onMultiUpdate?: (bookings: BookingInfo[]) => Promise<void>;
  bookers: Booker[];
  isAdmin?: boolean;
  currentAgentCode?: string;
  notify?: (msg: string, type: 'success' | 'error' | 'info') => void;
  requestConfirm?: (msg: string, action: () => void) => void;
}

const EditData: React.FC<EditDataProps> = ({
  buses,
  onUpdate,
  onDelete,
  onBulkDelete,
  onEdit,
  onMultiUpdate,
  bookers,
  isAdmin,
  currentAgentCode,
  notify,
  requestConfirm
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTour, setFilterTour] = useState('');
  const [filterBooker, setFilterBooker] = useState('');
  const [filterPayment, setFilterPayment] = useState<'all' | 'due' | 'paid'>('all');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [activeDueGroup, setActiveDueGroup] = useState<GroupedBookingBilling | null>(null);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  // Extract all bookings and filter by logged-in Agent feed (Admins see all)
  const allBookings: BookingInfo[] = useMemo(() => {
    const raw = buses.flatMap(b => b.seats.filter(s => s.isBooked).map(s => s.bookingInfo!));
    if (isAdmin) return raw;
    return raw.filter(b => b.bookerCode.toUpperCase() === currentAgentCode?.toUpperCase());
  }, [buses, isAdmin, currentAgentCode]);

  // Group bookings by primary lead booking / group ID so the main bill is under the primary passenger's name
  const groupedBillings: GroupedBookingBilling[] = useMemo(() => {
    const map = new Map<string, BookingInfo[]>();

    allBookings.forEach(b => {
      const gId = b.primaryBookingId || (b.totalGroupSeats && b.totalGroupSeats > 1 ? b.id : b.id);
      if (!map.has(gId)) {
        map.set(gId, []);
      }
      map.get(gId)!.push(b);
    });

    const list: GroupedBookingBilling[] = [];

    map.forEach((bookings, gId) => {
      // Find the primary lead booking
      const lead = bookings.find(b => b.isPrimary || b.id === gId) || bookings[0];
      const seats = Array.from(new Set(bookings.map(b => b.seatNo))).sort();
      const adv = bookings.reduce((sum, b) => sum + (b.advanceAmount || 0), 0);
      const due = bookings.reduce((sum, b) => sum + (b.dueAmount || 0), 0);
      const tourFees = bookings.reduce((sum, b) => sum + (b.tourFees || 0), 0);
      const custFees = bookings.reduce((sum, b) => sum + (b.customerTypeFees || 0), 0);
      const discount = bookings.reduce((sum, b) => sum + (b.discountAmount || 0), 0);
      const gross = (tourFees + custFees) - discount;

      list.push({
        id: gId,
        leadBooking: lead,
        passengers: bookings,
        seatsList: seats,
        totalSeats: lead.totalGroupSeats || seats.length,
        totalTourFees: tourFees,
        totalCustomerTypeFees: custFees,
        totalDiscount: discount,
        totalGrossAmount: Math.max(0, gross),
        totalAdvance: adv,
        totalDue: due,
        isPaidFull: due <= 0,
        agentName: lead.bookedBy || 'Admin',
        agentCode: lead.bookerCode || '',
        bookingDate: lead.bookingDate
      });
    });

    // Sort by newest booking date
    return list.sort((a, b) => new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime());
  }, [allBookings]);

  // Filter grouped billings
  const filteredGroups = useMemo(() => {
    return groupedBillings.filter(g => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = searchQuery === '' ||
        g.leadBooking.name.toLowerCase().includes(q) ||
        g.leadBooking.mobile.includes(searchQuery) ||
        g.seatsList.some(s => s.toLowerCase().includes(q)) ||
        g.agentCode.toLowerCase().includes(q) ||
        g.passengers.some(p => p.name.toLowerCase().includes(q) || p.mobile.includes(searchQuery));

      const matchesTour = filterTour === '' || g.leadBooking.tourName === filterTour || g.leadBooking.busNo === filterTour;
      const matchesBooker = filterBooker === '' || g.agentCode.toUpperCase() === filterBooker.toUpperCase();
      
      const matchesPayment = filterPayment === 'all' 
        ? true 
        : filterPayment === 'due' 
          ? g.totalDue > 0 
          : g.totalDue <= 0;

      return matchesSearch && matchesTour && matchesBooker && matchesPayment;
    });
  }, [groupedBillings, searchQuery, filterTour, filterBooker, filterPayment]);

  const uniqueTours = useMemo(() => Array.from(new Set(groupedBillings.map(g => g.leadBooking.tourName || g.leadBooking.busNo))), [groupedBillings]);

  // Overall Financial Stats for this view
  const stats = useMemo(() => {
    const totalCollected = filteredGroups.reduce((sum, g) => sum + g.totalAdvance, 0);
    const totalDuePending = filteredGroups.reduce((sum, g) => sum + g.totalDue, 0);
    const totalSeatsCount = filteredGroups.reduce((sum, g) => sum + g.totalSeats, 0);
    return { totalCollected, totalDuePending, totalSeatsCount };
  }, [filteredGroups]);

  // Handle Due Settlement from Modal
  const handleSettleDue = async (collectedAmount: number) => {
    if (!activeDueGroup || collectedAmount <= 0) return;

    const group = activeDueGroup;
    let remainingToDistribute = collectedAmount;

    // Distribute collected amount across the passengers in this group
    const updatedBookings: BookingInfo[] = group.passengers.map(p => {
      if (remainingToDistribute <= 0 || p.dueAmount <= 0) {
        return p;
      }
      const payForThisSeat = Math.min(p.dueAmount, remainingToDistribute);
      remainingToDistribute -= payForThisSeat;

      const newAdvance = (p.advanceAmount || 0) + payForThisSeat;
      const newDue = Math.max(0, (p.dueAmount || 0) - payForThisSeat);
      const newStatus = newDue === 0 ? 'Paid' : 'Partial';

      return {
        ...p,
        advanceAmount: newAdvance,
        dueAmount: newDue,
        paymentStatus: newStatus
      };
    });

    // If there's still amount left (e.g. edge rounding or lump sum on primary), put on primary
    if (remainingToDistribute > 0 && updatedBookings.length > 0) {
      const primaryIdx = updatedBookings.findIndex(p => p.isPrimary || p.id === group.id);
      const targetIdx = primaryIdx !== -1 ? primaryIdx : 0;
      updatedBookings[targetIdx] = {
        ...updatedBookings[targetIdx],
        advanceAmount: (updatedBookings[targetIdx].advanceAmount || 0) + remainingToDistribute,
        dueAmount: Math.max(0, (updatedBookings[targetIdx].dueAmount || 0) - remainingToDistribute),
        paymentStatus: (updatedBookings[targetIdx].dueAmount - remainingToDistribute) <= 0 ? 'Paid' : 'Partial'
      };
    }

    if (onMultiUpdate) {
      await onMultiUpdate(updatedBookings);
    } else {
      for (const b of updatedBookings) {
        onUpdate(b);
      }
    }

    notify?.(`৳${collectedAmount.toLocaleString()} বকেয়া সফলভাবে পরিশোধ করা হয়েছে!`, 'success');
  };

  // Bulk / Single Delete (Admin only)
  const handleDeleteGroup = (group: GroupedBookingBilling) => {
    if (!isAdmin) {
      notify?.("শুধুমাত্র এডমিন বুকিং ডাটা ডিলিট করতে পারেন।", 'error');
      return;
    }

    const groupBookingIds = group.passengers.map(p => p.id);
    const msg = `এডমিন সতর্কবার্তা: ${group.leadBooking.name}-এর ${group.totalSeats}টি সিটের সম্পূর্ণ বুকিং স্থায়ীভাবে ডিলিট করতে চান?`;

    if (requestConfirm) {
      requestConfirm(msg, () => {
        if (onBulkDelete) {
          onBulkDelete(groupBookingIds);
        } else {
          group.passengers.forEach(p => onDelete(p.busNo, p.seatNo));
        }
        notify?.(`বুকিং ও সিট সফলভাবে ডিলিট হয়েছে।`, 'success');
      });
    } else if (window.confirm(msg)) {
      if (onBulkDelete) {
        onBulkDelete(groupBookingIds);
      } else {
        group.passengers.forEach(p => onDelete(p.busNo, p.seatNo));
      }
    }
  };

  const handleBulkDeleteSelected = () => {
    if (!isAdmin || selectedGroupIds.length === 0) return;

    const allSelectedBookingIds = groupedBillings
      .filter(g => selectedGroupIds.includes(g.id))
      .flatMap(g => g.passengers.map(p => p.id));

    const msg = `এডমিন অ্যাকশন: নির্বাচিত ${selectedGroupIds.length}টি বুকিং গ্রুপের মোট ${allSelectedBookingIds.length}টি সিট ডিলিট করতে চান?`;

    if (requestConfirm) {
      requestConfirm(msg, () => {
        onBulkDelete?.(allSelectedBookingIds);
        setSelectedGroupIds([]);
        notify?.("নির্বাচিত বুকিং সফলভাবে ডিলিট হয়েছে।", 'success');
      });
    } else if (window.confirm(msg)) {
      onBulkDelete?.(allSelectedBookingIds);
      setSelectedGroupIds([]);
    }
  };

  return (
    <div className="animate-in fade-in duration-500 max-w-6xl mx-auto md:pl-12 space-y-6 pb-24">
      
      {/* Header & Stats Banner */}
      <div className="bg-white rounded-[32px] shadow-sm p-6 md:p-8 border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full flex items-center gap-1">
              <i className="fas fa-file-invoice-dollar"></i> বিলিং ও এডিট সেন্টার
            </span>
            {isAdmin ? (
              <span className="text-[9px] font-black text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full uppercase flex items-center gap-1">
                <i className="fas fa-shield-alt"></i> Admin View (All Feed & Delete Access)
              </span>
            ) : (
              <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full uppercase flex items-center gap-1">
                <i className="fas fa-user-check"></i> Agent Feed ({currentAgentCode})
              </span>
            )}
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-[#001D4A] tracking-tight mt-2">
            বুকিং বিল ও বকেয়া ব্যবস্থাপনা
          </h2>
          <p className="text-gray-400 text-xs font-bold mt-1">
            প্রধান বুকিংকারীর নামে সম্মিলিত বিল, অগ্রিম ও বকেয়ার হিসাব এবং কো-প্যাসেঞ্জার তালিকা।
          </p>
        </div>

        {/* Quick Financial Snapshot */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full md:w-auto">
          <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 text-left min-w-[120px]">
            <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wider block">মোট পেইড (Advance)</span>
            <span className="text-lg md:text-xl font-black text-emerald-700">৳{stats.totalCollected.toLocaleString()}</span>
          </div>
          <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 text-left min-w-[120px]">
            <span className="text-[9px] font-black text-rose-600 uppercase tracking-wider block">মোট বকেয়া (Due)</span>
            <span className="text-lg md:text-xl font-black text-rose-700">৳{stats.totalDuePending.toLocaleString()}</span>
          </div>
          <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 text-left min-w-[90px] col-span-2 sm:col-span-1">
            <span className="text-[9px] font-black text-indigo-600 uppercase tracking-wider block">বুকড সিট</span>
            <span className="text-lg md:text-xl font-black text-indigo-900">{stats.totalSeatsCount} টি</span>
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white rounded-[32px] shadow-sm p-6 md:p-8 border border-gray-100 sticky top-0 md:relative z-20 space-y-4">
        <div className="relative group">
          <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-gray-400"></i>
          <input 
            className="w-full pl-14 pr-6 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold outline-none shadow-inner focus:ring-2 focus:ring-indigo-500/20 text-[#001D4A]" 
            placeholder="Search by Primary Passenger Name, Mobile, Seat, or Co-Passenger..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <select 
            value={filterTour}
            onChange={(e) => setFilterTour(e.target.value)}
            className="w-full px-4 py-3.5 bg-indigo-50/70 border-none rounded-2xl font-black text-indigo-900 text-xs uppercase outline-none"
          >
            <option value="">সকল ট্যুর (All Tours)</option>
            {uniqueTours.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <select 
            value={filterPayment}
            onChange={(e) => setFilterPayment(e.target.value as any)}
            className="w-full px-4 py-3.5 bg-indigo-50/70 border-none rounded-2xl font-black text-indigo-900 text-xs uppercase outline-none"
          >
            <option value="all">পেমেন্ট স্ট্যাটাস: সকল</option>
            <option value="due">⚠️ শুধু বকেয়া আছে (Has Due)</option>
            <option value="paid">✓ সম্পূর্ণ পেইড (Paid Full)</option>
          </select>

          <select 
            value={filterBooker}
            onChange={(e) => setFilterBooker(e.target.value)}
            className="w-full px-4 py-3.5 bg-indigo-50/70 border-none rounded-2xl font-black text-indigo-900 text-xs uppercase outline-none"
          >
            <option value="">{isAdmin ? 'সকল এজেন্ট (All Agents)' : 'আমার বুকিং ফিড'}</option>
            {bookers.filter(a => isAdmin || a.code.toUpperCase() === currentAgentCode?.toUpperCase()).map(agent => (
              <option key={agent.code} value={agent.code}>{agent.name} ({agent.code})</option>
            ))}
          </select>

          {isAdmin && (
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  if (selectedGroupIds.length === filteredGroups.length && filteredGroups.length > 0) {
                    setSelectedGroupIds([]);
                  } else {
                    setSelectedGroupIds(filteredGroups.map(g => g.id));
                  }
                }}
                className="flex-1 px-3 py-3 bg-[#001D4A] text-white rounded-2xl font-black text-[10px] uppercase hover:bg-[#002868] transition-all"
              >
                {selectedGroupIds.length === filteredGroups.length && filteredGroups.length > 0 ? 'Deselect All' : 'Select All'}
              </button>
              <button 
                onClick={handleBulkDeleteSelected}
                disabled={selectedGroupIds.length === 0}
                className="flex-1 px-3 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-[10px] uppercase disabled:opacity-40 transition-all"
              >
                Delete ({selectedGroupIds.length})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bill List / Groups Cards */}
      <div className="space-y-4">
        {filteredGroups.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-[32px] border-2 border-dashed border-gray-200">
            <i className="fas fa-file-invoice text-gray-300 text-5xl mb-4"></i>
            <h4 className="text-base font-black text-gray-500 uppercase tracking-wider">কোন বুকিং বিল পাওয়া যায়নি</h4>
            <p className="text-gray-400 text-xs mt-1">অনুসন্ধানের কিওয়ার্ড বা ফিল্টার পরিবর্তন করে চেষ্টা করুন।</p>
          </div>
        ) : (
          filteredGroups.map(group => {
            const isSelected = selectedGroupIds.includes(group.id);
            const isExpanded = expandedGroupId === group.id;
            const coPassengers = group.passengers.filter(p => !p.isPrimary && p.id !== group.leadBooking.id);

            return (
              <div 
                key={group.id} 
                className={`bg-white rounded-[32px] border transition-all duration-200 overflow-hidden ${
                  isSelected ? 'border-indigo-600 ring-2 ring-indigo-50 shadow-md' : 'border-gray-100 shadow-sm hover:border-gray-200'
                }`}
              >
                {/* Main Card Header */}
                <div className="p-6 md:p-7 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                  
                  {/* Passenger & Tour Info */}
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    {isAdmin && (
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={() => setSelectedGroupIds(prev => prev.includes(group.id) ? prev.filter(id => id !== group.id) : [...prev, group.id])}
                        className="mt-1.5 w-5 h-5 rounded-lg border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    )}

                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] font-black text-indigo-700 bg-indigo-50 px-3 py-1 rounded-xl uppercase tracking-wider">
                          {group.leadBooking.tourName || group.leadBooking.busNo}
                        </span>
                        <span className="text-[9px] font-black text-white bg-[#001D4A] px-3 py-1 rounded-xl uppercase tracking-wider flex items-center gap-1 shadow-sm">
                          <i className="fas fa-couch text-[8px]"></i>
                          {group.totalSeats > 1 ? `Seats: ${group.seatsList.join(', ')} (${group.totalSeats})` : `Seat: ${group.leadBooking.seatNo}`}
                        </span>
                        <span className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider ${
                          group.isPaidFull 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {group.isPaidFull ? '✓ Paid Full' : '⚠️ Due Pending'}
                        </span>
                      </div>

                      {/* Primary Passenger Name */}
                      <div className="pt-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest bg-orange-50 px-2 py-0.5 rounded-md">
                            প্রধান বুকিংকারী (Lead)
                          </span>
                        </div>
                        <h3 className="text-xl md:text-2xl font-black text-[#001D4A] leading-tight truncate mt-0.5">
                          {group.leadBooking.name}
                        </h3>
                        <p className="text-xs font-bold text-gray-500 flex items-center gap-2 mt-1">
                          <span>+880{group.leadBooking.mobile}</span>
                          <span>•</span>
                          <span>Agent: <strong className="text-indigo-900">{group.agentName} ({group.agentCode})</strong></span>
                          <span>•</span>
                          <span className="text-gray-400">{new Date(group.bookingDate).toLocaleDateString()}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Financial Bill Breakdown */}
                  <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end border-t lg:border-t-0 pt-4 lg:pt-0 border-gray-100">
                    <div className="bg-gray-50 px-4 py-2.5 rounded-2xl text-left border border-gray-100">
                      <span className="text-[8px] font-black text-gray-400 uppercase tracking-wider block leading-none mb-1">মোট বিল (Gross)</span>
                      <span className="text-sm font-black text-gray-800">৳{group.totalGrossAmount.toLocaleString()}</span>
                    </div>

                    <div className="bg-emerald-50 px-4 py-2.5 rounded-2xl text-left border border-emerald-100">
                      <span className="text-[8px] font-black text-emerald-600 uppercase tracking-wider block leading-none mb-1">অগ্রিম (Advance)</span>
                      <span className="text-sm md:text-base font-black text-emerald-700">৳{group.totalAdvance.toLocaleString()}</span>
                    </div>

                    <div className={`px-4 py-2.5 rounded-2xl text-left border ${group.totalDue > 0 ? 'bg-rose-50 border-rose-200' : 'bg-gray-50 border-gray-100'}`}>
                      <span className={`text-[8px] font-black uppercase tracking-wider block leading-none mb-1 ${group.totalDue > 0 ? 'text-rose-600' : 'text-gray-400'}`}>
                        বকেয়া (Due)
                      </span>
                      <span className={`text-base md:text-lg font-black ${group.totalDue > 0 ? 'text-rose-700' : 'text-gray-500'}`}>
                        ৳{group.totalDue.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 w-full lg:w-auto border-t lg:border-t-0 pt-3 lg:pt-0 border-gray-100">
                    {/* Due Clear Button (Available to Booker Agent and Admin) */}
                    {group.totalDue > 0 && (
                      <button
                        onClick={() => setActiveDueGroup(group)}
                        className="flex-1 lg:flex-none px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-md shadow-emerald-600/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                      >
                        <i className="fas fa-hand-holding-dollar"></i>
                        <span>বকেয়া ক্লিয়ার</span>
                      </button>
                    )}

                    {/* Edit Passenger Booking Details */}
                    <button
                      onClick={() => onEdit(group.leadBooking)}
                      className="px-3.5 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1"
                      title="Edit Booking"
                    >
                      <i className="fas fa-pen-to-square"></i>
                      <span className="hidden sm:inline">Edit</span>
                    </button>

                    {/* Delete (Admin only) */}
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteGroup(group)}
                        className="px-3.5 py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1"
                        title="Delete Entire Booking"
                      >
                        <i className="fas fa-trash-alt"></i>
                        <span className="hidden sm:inline">Delete</span>
                      </button>
                    )}

                    {/* Toggle Co-Passenger View */}
                    {coPassengers.length > 0 && (
                      <button
                        onClick={() => setExpandedGroupId(isExpanded ? null : group.id)}
                        className="px-3.5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-1"
                      >
                        <span>Co-Passengers ({coPassengers.length})</span>
                        <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'} text-[10px]`}></i>
                      </button>
                    )}
                  </div>
                </div>

                {/* Co-Passengers Dropdown Section */}
                {isExpanded && coPassengers.length > 0 && (
                  <div className="bg-gray-50/70 p-5 md:p-6 border-t border-dashed border-gray-200 space-y-3">
                    <h5 className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                      <i className="fas fa-users text-indigo-500"></i>
                      <span>কো-প্যাসেঞ্জার তালিকা (Co-Passenger Details)</span>
                    </h5>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {coPassengers.map((cp, idx) => (
                        <div key={cp.id} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex justify-between items-center">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[8px] font-black bg-[#001D4A] text-white px-2 py-0.5 rounded uppercase">
                                Seat {cp.seatNo}
                              </span>
                              <span className="text-[8px] font-bold text-gray-400">#{idx + 2}</span>
                            </div>
                            <h6 className="font-black text-sm text-[#001D4A] mt-1">{cp.name}</h6>
                            <p className="text-[10px] font-bold text-gray-500 mt-0.5">
                              {cp.mobile ? `+880${cp.mobile}` : 'Same contact as Lead'} • {cp.gender || 'MALE'}
                            </p>
                          </div>
                          
                          <button
                            onClick={() => onEdit(cp)}
                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-black rounded-xl uppercase transition-all"
                          >
                            Edit
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            );
          })
        )}
      </div>

      {/* Due Collection Modal */}
      {activeDueGroup && (
        <DueCollectionModal
          group={activeDueGroup}
          onClose={() => setActiveDueGroup(null)}
          onSettle={handleSettleDue}
          isAdmin={isAdmin}
        />
      )}

    </div>
  );
};

export default EditData;
