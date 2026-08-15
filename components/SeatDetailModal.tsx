
import React, { useRef, useState, useMemo } from 'react';
import { BookingInfo, Booker } from '../types';
import { BUSINESS_INFO } from '../constants';
import PaymentModal from './PaymentModal';

interface SeatDetailModalProps {
  info: BookingInfo;
  allBookings?: BookingInfo[];
  bookers?: Booker[];
  onClose: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onUpdate?: (updatedInfo: BookingInfo) => void;
  isAdmin?: boolean;
  currentAgentCode?: string;
  notify?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const SeatDetailModal: React.FC<SeatDetailModalProps> = ({
  info,
  allBookings = [],
  bookers = [],
  onClose,
  onEdit,
  onCancel,
  onUpdate,
  isAdmin,
  currentAgentCode,
  notify
}) => {
  const ticketRef = useRef<HTMLDivElement>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const canEdit = isAdmin || info.bookerCode.toUpperCase() === currentAgentCode?.toUpperCase();

  // Find agent's contact number
  const agentObj = useMemo(() => {
    return bookers.find(b => b.code.toUpperCase() === info.bookerCode.toUpperCase() || b.name.toLowerCase() === info.bookedBy.toLowerCase());
  }, [bookers, info.bookerCode, info.bookedBy]);
  const agentPhone = agentObj?.mobile || agentObj?.phone || '';

  // Determine if this booking belongs to a group/combined booking
  const groupId = info.primaryBookingId || (info.totalGroupSeats && info.totalGroupSeats > 1 ? info.id : null);
  
  // Find all sibling bookings in this group
  const groupMembers = useMemo(() => {
    if (!groupId) return [info];
    return allBookings.filter(b => b.id === groupId || b.primaryBookingId === groupId);
  }, [allBookings, groupId, info]);

  const isGroup = groupMembers.length > 1 || (info.totalGroupSeats && info.totalGroupSeats > 1);

  // Find Primary Booking / Passenger
  const primaryBooking = useMemo(() => {
    if (!isGroup) return info;
    const found = groupMembers.find(b => b.isPrimary || b.id === groupId);
    return found || info;
  }, [isGroup, groupMembers, groupId, info]);

  // Group aggregated seats list & financials
  const groupSeatsList: string[] = useMemo(() => {
    let rawSeats = info.groupSeatsList;
    if (typeof rawSeats === 'string') {
      try {
        const parsed = JSON.parse(rawSeats);
        if (Array.isArray(parsed)) rawSeats = parsed;
      } catch (e) {
        rawSeats = (rawSeats as string).split(',').map(s => s.trim()).filter(Boolean);
      }
    }
    if (Array.isArray(rawSeats) && rawSeats.length > 0) {
      return rawSeats.map(String);
    }
    if (groupMembers && groupMembers.length > 0) {
      return Array.from(new Set(groupMembers.map(b => String(b.seatNo)))).sort();
    }
    return [String(info.seatNo)];
  }, [info.groupSeatsList, groupMembers, info.seatNo]);

  const groupTotalAdvance = useMemo(() => {
    return groupMembers.reduce((sum, b) => sum + (b.advanceAmount || 0), 0);
  }, [groupMembers]);

  const groupTotalDue = useMemo(() => {
    return groupMembers.reduce((sum, b) => sum + (b.dueAmount || 0), 0);
  }, [groupMembers]);

  const groupTotalFees = useMemo(() => {
    return groupMembers.reduce((sum, b) => sum + (b.tourFees + (b.customerTypeFees || 0)), 0);
  }, [groupMembers]);

  const displaySeatString = isGroup ? groupSeatsList.join(', ') : info.seatNo;
  const displayTotalSeats = isGroup ? (info.totalGroupSeats || groupSeatsList.length) : 1;

  const qrData = `TOUR-LAGBE|ID:${info.id}|Seats:${displaySeatString}|Lead:${primaryBooking.name}|Phone:${primaryBooking.mobile}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;

  const handleProcessPayment = async (amount: number) => {
    if (onUpdate) {
      const newAdvance = info.advanceAmount + amount;
      const newDue = info.dueAmount - amount;
      const updatedInfo: BookingInfo = {
        ...info,
        advanceAmount: newAdvance,
        dueAmount: newDue,
        paymentStatus: newDue <= 0 ? 'Paid' : 'Partial'
      };
      
      try {
        await onUpdate(updatedInfo);
        setShowPaymentModal(false);
        notify?.("Payment processed successfully!", 'success');
      } catch (error) {
        console.error("Update failed:", error);
        notify?.("Could not process payment. Please try again.", 'error');
      }
    }
  };

  const handleShareTicket = async () => {
    const totalAmount = isGroup ? groupTotalFees : (info.tourFees + (info.customerTypeFees || 0));
    const advancePaid = isGroup ? groupTotalAdvance : info.advanceAmount;
    const dueBal = isGroup ? groupTotalDue : info.dueAmount;

    const message = `
🎫 *${BUSINESS_INFO.name} - Official Combined Ticket*
---------------------------------------
👤 *Primary Passenger:* ${primaryBooking.name}
${!info.isPrimary && isGroup ? `💺 *Seat Passenger:* ${info.name}\n` : ''}📍 *Tour:* ${info.tourName}
💺 *Seats (${displayTotalSeats}):* ${displaySeatString}
📞 *Contact:* +880${primaryBooking.mobile}

💰 *Total Price:* ৳${totalAmount.toLocaleString()}
💵 *Advance Paid:* ৳${advancePaid.toLocaleString()}
🔴 *Due Balance:* ৳${dueBal.toLocaleString()}
✅ *Status:* ${dueBal <= 0 ? 'Paid' : 'Partial'}

🆔 *Booking ID:* ${primaryBooking.id}
📝 *Booked By:* ${info.bookedBy} ${agentPhone ? `(${agentPhone})` : ''}
📅 *Date:* ${new Date(info.bookingDate).toLocaleDateString()}
---------------------------------------
*Thank you for choosing ${BUSINESS_INFO.name}!*
📍 ${BUSINESS_INFO.address}
`.trim();

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Ticket for ${primaryBooking.name}`,
          text: message,
        });
      } catch (err) {
        console.error("Share failed:", err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(message);
        notify?.("Ticket details copied to clipboard!", 'success');
      } catch (err) {
        notify?.("Could not share ticket.", 'error');
      }
    }
  };

  const printTicket = () => {
    const printContent = ticketRef.current;
    if (!printContent) return;

    const windowPrint = window.open('', '', 'left=0,top=0,width=900,height=1000,toolbar=0,scrollbars=0,status=0');
    if (windowPrint) {
      windowPrint.document.write(`
        <html>
          <head>
            <title>Ticket - ${primaryBooking.name} (${displaySeatString})</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;700&family=Inter:wght@400;700;900&display=swap" rel="stylesheet">
            <style>
              body { font-family: 'Inter', 'Hind Siliguri', sans-serif; background: white; margin: 0; padding: 20px; }
              .ticket-print-wrap { width: 100%; max-width: 600px; margin: 0 auto; }
            </style>
          </head>
          <body>
            <div class="ticket-print-wrap">
              ${printContent.innerHTML}
            </div>
            <script>
              window.onload = () => {
                setTimeout(() => {
                  window.print();
                  window.close();
                }, 500);
              };
            </script>
          </body>
        </html>
      `);
      windowPrint.document.close();
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-[#001D4A]/80 backdrop-blur-md overflow-y-auto">
        <div className="bg-white w-full max-w-xl rounded-[40px] shadow-2xl my-auto animate-in zoom-in duration-300 overflow-hidden border border-white/20">
          
          <div className="p-4 md:p-8">
             {/* Header */}
             <div className="flex justify-between items-start mb-4 px-2">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-black text-white bg-indigo-600 px-3 py-1 rounded-full uppercase inline-block tracking-widest shadow-md">
                      Seat {info.seatNo}
                    </span>
                    {isGroup && (
                      <span className="text-[10px] font-black text-white bg-gradient-to-r from-orange-500 to-amber-500 px-3 py-1 rounded-full uppercase tracking-wider shadow-md">
                        Combined Group ({displayTotalSeats} Seats)
                      </span>
                    )}
                  </div>
                  <h3 className="text-2xl md:text-4xl font-black text-[#001D4A] tracking-tighter leading-none truncate max-w-[320px]">
                    {info.name}
                  </h3>
                  {!info.isPrimary && isGroup && (
                    <p className="text-xs font-bold text-orange-600 mt-1">
                      (প্রধান বুকিংকারী: <span className="font-black text-[#001D4A]">{primaryBooking.name}</span>)
                    </p>
                  )}
                </div>
                <button onClick={onClose} className="w-10 h-10 md:w-12 md:h-12 bg-gray-50 rounded-full flex items-center justify-center transition-all text-gray-400 active:scale-90 hover:bg-gray-100">
                  <i className="fas fa-times text-xl"></i>
                </button>
             </div>

             {/* Group Booking Summary Banner */}
             {isGroup && (
               <div className="mb-4 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-orange-200">
                 <div className="flex items-center gap-2 mb-2 text-orange-800 font-black text-xs uppercase">
                   <i className="fas fa-users text-sm text-orange-500"></i>
                   <span>কম্বাইন্ড গ্রুপ বুকিং তথ্য (Group Overview)</span>
                 </div>
                 <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                   <div className="bg-white/80 p-2.5 rounded-xl border border-orange-100">
                     <p className="text-[9px] font-black text-gray-400 uppercase">মোট সিট সংখ্যা</p>
                     <p className="font-black text-indigo-900 text-sm">{displayTotalSeats} টি সিট</p>
                   </div>
                   <div className="bg-white/80 p-2.5 rounded-xl border border-orange-100">
                     <p className="text-[9px] font-black text-gray-400 uppercase">সিট সমূহ</p>
                     <p className="font-black text-orange-600 text-sm truncate">{displaySeatString}</p>
                   </div>
                   <div className="col-span-2 md:col-span-1 bg-white/80 p-2.5 rounded-xl border border-orange-100">
                     <p className="text-[9px] font-black text-gray-400 uppercase">প্রধান যাত্রী</p>
                     <p className="font-black text-gray-900 text-sm truncate">{primaryBooking.name}</p>
                   </div>
                 </div>
               </div>
             )}

             {/* Official Ticket Card */}
             <div ref={ticketRef} className="bg-white border-2 border-dashed border-gray-300 rounded-[32px] md:rounded-[40px] p-6 md:p-8 mb-6 relative overflow-hidden shadow-sm">
                <div className="absolute -left-5 top-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full border-r-2 border-dashed border-gray-300 z-10"></div>
                <div className="absolute -right-5 top-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full border-l-2 border-dashed border-gray-300 z-10"></div>
                
                <div className="flex justify-between items-start mb-6">
                   <div>
                      <img src={BUSINESS_INFO.logo} alt="Logo" className="h-11 md:h-14 mb-2 object-contain" />
                      <h4 className="text-base md:text-lg font-black text-[#001D4A] tracking-tight leading-none">{BUSINESS_INFO.name}</h4>
                      <p className="text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-wider max-w-[260px] leading-relaxed mt-1">
                        {BUSINESS_INFO.address}
                      </p>
                   </div>
                   <div className="text-right">
                      <div className="bg-[#001D4A] text-white px-5 py-3 md:px-6 md:py-3.5 rounded-2xl flex flex-col items-center shadow-xl shadow-indigo-900/10">
                        <span className="text-[9px] md:text-[11px] font-black uppercase tracking-[0.2em] text-orange-400">
                          {isGroup ? `SEATS (${displayTotalSeats})` : 'SEAT'}
                        </span>
                        <span className="text-2xl md:text-3xl font-black leading-tight max-w-[200px] truncate text-amber-300">
                          {displaySeatString}
                        </span>
                      </div>
                   </div>
                </div>

                <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-center border-t border-dashed border-gray-200 pt-6">
                   <div className="flex-grow grid grid-cols-2 gap-y-4 md:gap-y-5 gap-x-6 w-full text-left">
                      <div className="bg-gray-50/80 p-3 rounded-2xl border border-gray-100">
                          <p className="text-[10px] md:text-[11px] font-black text-gray-400 uppercase tracking-wider mb-0.5">Primary Passenger</p>
                          <p className="text-base md:text-lg font-black text-[#001D4A] truncate">{primaryBooking.name}</p>
                          <p className="text-xs text-gray-500 font-bold mt-0.5">
                            {info.gender || 'Male'} • {info.religion || 'Muslim'}
                          </p>
                      </div>
                      <div className="bg-gray-50/80 p-3 rounded-2xl border border-gray-100">
                          <p className="text-[10px] md:text-[11px] font-black text-gray-400 uppercase tracking-wider mb-0.5">Contact Mobile</p>
                          <p className="text-base md:text-lg font-black text-gray-800 tracking-wide">+880{primaryBooking.mobile}</p>
                          <span className="text-[10px] text-emerald-600 font-bold">Verified Contact</span>
                      </div>
                      <div className="bg-indigo-50/60 p-3 rounded-2xl border border-indigo-100/60">
                          <p className="text-[10px] md:text-[11px] font-black text-indigo-500 uppercase tracking-wider mb-0.5">Route / Tour</p>
                          <p className="text-sm md:text-base font-black text-indigo-950 truncate">{info.tourName || info.busNo}</p>
                      </div>
                      <div className="bg-emerald-50/60 p-3 rounded-2xl border border-emerald-100/60">
                          <p className="text-[10px] md:text-[11px] font-black text-emerald-600 uppercase tracking-wider mb-0.5">Total Paid (Advance)</p>
                          <p className="text-base md:text-lg font-black text-emerald-700">
                            ৳{(isGroup ? groupTotalAdvance : info.advanceAmount).toLocaleString()}
                          </p>
                      </div>
                   </div>
                   
                   <div className="shrink-0 flex flex-col items-center bg-gray-50 p-3 rounded-2xl border border-gray-100">
                      <img src={qrCodeUrl} alt="QR" className="w-24 h-24 md:w-28 md:h-28 object-contain" />
                      <p className="text-[10px] font-black text-gray-700 uppercase mt-1 tracking-wider">ID: {primaryBooking.id.slice(0, 8)}</p>
                      <span className="text-[8px] text-gray-400 font-bold">Official E-Ticket</span>
                   </div>
                </div>

                <div className="border-t border-dashed border-gray-200 my-5 pt-5 flex justify-between items-end">
                   <div className="text-left">
                      <p className="text-[10px] md:text-[11px] font-black text-gray-400 uppercase tracking-wider mb-0.5">Booked By Agent</p>
                      <p className="text-sm md:text-base font-black text-gray-900 leading-none">
                        {info.bookedBy || 'System Admin'}
                      </p>
                      {agentPhone && (
                        <p className="text-xs font-bold text-indigo-700 mt-1.5 flex items-center gap-1.5">
                          <i className="fas fa-phone-alt text-[10px]"></i> +880{agentPhone}
                        </p>
                      )}
                   </div>
                   <div className="text-right">
                      {(isGroup ? groupTotalDue : info.dueAmount) > 0 ? (
                        <div className="bg-rose-50 px-4 py-2 rounded-2xl border border-rose-100 text-right">
                          <p className="text-[10px] md:text-[11px] font-black text-rose-500 uppercase tracking-wider mb-0.5">Total Remaining Due</p>
                          <p className="text-2xl md:text-3xl font-black text-rose-600 leading-none">
                            ৳{(isGroup ? groupTotalDue : info.dueAmount).toLocaleString()}
                          </p>
                        </div>
                      ) : (
                        <span className="px-5 py-2.5 rounded-2xl text-sm font-black uppercase tracking-wider bg-emerald-600 text-white shadow-md shadow-emerald-600/20 inline-block">
                          ✓ PAID FULL
                        </span>
                      )}
                   </div>
                </div>
             </div>

             {/* Action Buttons */}
             <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={printTicket}
                    className="py-4 bg-[#312e81] text-white rounded-[24px] font-black text-sm shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 transition-all active:scale-95 hover:bg-indigo-900"
                  >
                    <i className="fas fa-print"></i> {isGroup ? 'Print Group Ticket' : 'Print Ticket'}
                  </button>

                  <button 
                    onClick={handleShareTicket}
                    className="py-4 bg-[#10a342] text-white rounded-[24px] font-black text-sm shadow-xl shadow-green-100 flex items-center justify-center gap-2 transition-all active:scale-95 hover:bg-green-700"
                  >
                    <i className="fas fa-share-nodes"></i> Share Ticket
                  </button>
                  
                  <button 
                    onClick={onEdit}
                    disabled={!canEdit}
                    className={`py-4 rounded-[24px] font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${canEdit ? 'bg-[#eef5ff] text-[#3b82f6] hover:bg-blue-100' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}
                  >
                    <i className="fas fa-user-edit"></i> Edit Passenger
                  </button>

                  <button 
                    onClick={() => setShowPaymentModal(true)}
                    disabled={info.dueAmount <= 0 || !canEdit}
                    className={`py-4 rounded-[24px] font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xl ${info.dueAmount > 0 && canEdit ? 'bg-[#ff7a1a] text-white shadow-orange-100 hover:bg-orange-600' : 'bg-gray-100 text-gray-300 cursor-not-allowed shadow-none'}`}
                  >
                    <i className="fas fa-money-bill-wave"></i> Due Pay ৳{info.dueAmount}
                  </button>
                </div>

                {isAdmin && (
                  <button 
                    onClick={onCancel}
                    className="w-full py-3.5 bg-[#fff1f1] text-red-500 rounded-[24px] font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 hover:bg-red-100"
                  >
                    <i className="fas fa-trash-alt"></i> Cancel Booking Permanently
                  </button>
                )}
             </div>
          </div>
        </div>
      </div>

      {showPaymentModal && (
        <PaymentModal 
          info={info} 
          onClose={() => setShowPaymentModal(false)} 
          onConfirm={handleProcessPayment} 
          isAdmin={isAdmin}
          notify={notify}
        />
      )}
    </>
  );
};

export default SeatDetailModal;
