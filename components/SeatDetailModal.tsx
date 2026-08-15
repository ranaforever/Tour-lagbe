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
    const found = allBookings.filter(b => b.id === groupId || b.primaryBookingId === groupId);
    return found.length > 0 ? found : [info];
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

  // Accurate financial calculation & verification
  const totalAmount = isGroup ? groupTotalFees : (info.tourFees + (info.customerTypeFees || 0) - (info.discountAmount || 0));
  const advancePaid = isGroup ? groupTotalAdvance : (info.advanceAmount || 0);
  const remainingDue = isGroup ? groupTotalDue : (info.dueAmount !== undefined && info.dueAmount > 0 ? info.dueAmount : Math.max(0, totalAmount - advancePaid));
  
  // Real payment status check
  const isTrulyPaidFull = totalAmount > 0 && advancePaid >= totalAmount && remainingDue <= 0;
  const isUnpaid = advancePaid === 0;

  const qrData = `TOUR-LAGBE|ID:${primaryBooking.id}|Seats:${displaySeatString}|Lead:${primaryBooking.name}|Phone:${primaryBooking.mobile}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;

  const handleProcessPayment = async (amount: number) => {
    if (onUpdate) {
      const newAdvance = (info.advanceAmount || 0) + amount;
      const newDue = Math.max(0, (info.dueAmount || 0) - amount);
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
    const statusText = isTrulyPaidFull ? 'PAID FULL' : (isUnpaid ? 'UNPAID / DUE' : 'PARTIAL DUE');

    const message = `
🎫 *${BUSINESS_INFO.name} - Official Ticket*
---------------------------------------
👤 *Primary Passenger:* ${primaryBooking.name}
${!info.isPrimary && isGroup ? `💺 *Seat Passenger:* ${info.name}\n` : ''}📍 *Tour:* ${info.tourName || info.busNo}
💺 *Seat(s) (${displayTotalSeats}):* ${displaySeatString}
📞 *Contact:* +880${primaryBooking.mobile}

💰 *Total Price:* ৳${(totalAmount || 0).toLocaleString()}
💵 *Total Paid:* ৳${(advancePaid || 0).toLocaleString()}
🔴 *Due Balance:* ৳${(remainingDue || 0).toLocaleString()}
✅ *Status:* ${statusText}

🆔 *Booking ID:* ${primaryBooking.id}
📝 *Booked By:* ${info.bookedBy} ${agentPhone ? `(+880${agentPhone})` : ''}
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
        <!DOCTYPE html>
        <html>
          <head>
            <title>Ticket - ${primaryBooking.name} (${displaySeatString})</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700;800&family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">
            <style>
              @page { size: auto; margin: 10mm; }
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
              body { font-family: 'Inter', 'Hind Siliguri', sans-serif; background: white; margin: 0; padding: 15px; }
              .ticket-print-wrap { width: 100%; max-width: 650px; margin: 0 auto; }
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
                }, 400);
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
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-[#001D4A]/80 backdrop-blur-md overflow-y-auto">
        <div className="bg-white w-full max-w-xl rounded-[28px] sm:rounded-[36px] md:rounded-[40px] shadow-2xl my-auto animate-in zoom-in-95 duration-200 overflow-hidden border border-white/20 max-h-[94vh] flex flex-col">
          
          <div className="p-3.5 sm:p-5 md:p-7 overflow-y-auto">
             {/* Header */}
             <div className="flex justify-between items-start gap-3 mb-3.5 px-1">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1.5">
                    <span className="text-[10px] sm:text-xs font-black text-white bg-indigo-600 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full uppercase tracking-wider shadow-sm">
                      Seat {info.seatNo}
                    </span>
                    {isGroup && (
                      <span className="text-[10px] sm:text-xs font-black text-white bg-gradient-to-r from-orange-500 to-amber-500 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full uppercase tracking-wider shadow-sm">
                        Group ({displayTotalSeats} Seats)
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-[#001D4A] tracking-tight leading-tight break-words">
                    {info.name}
                  </h3>
                  {!info.isPrimary && isGroup && (
                    <p className="text-xs font-bold text-orange-600 mt-0.5 truncate">
                      (প্রধান বুকিংকারী: <span className="font-black text-[#001D4A]">{primaryBooking.name}</span>)
                    </p>
                  )}
                </div>
                <button 
                  onClick={onClose} 
                  className="w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 bg-gray-100 rounded-full flex items-center justify-center transition-all text-gray-500 active:scale-90 hover:bg-gray-200 shrink-0"
                  title="বন্ধ করুন (Close)"
                >
                  <i className="fas fa-times text-base sm:text-lg"></i>
                </button>
             </div>

             {/* Group Booking Summary Banner */}
             {isGroup && (
               <div className="mb-3.5 p-3 sm:p-3.5 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-orange-200/80">
                 <div className="flex items-center gap-1.5 mb-2 text-orange-900 font-black text-xs uppercase">
                   <i className="fas fa-users text-sm text-orange-500"></i>
                   <span>গ্রুপ বুকিং বিবরণ (Group Overview)</span>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                   <div className="bg-white/90 p-2 rounded-xl border border-orange-100">
                     <p className="text-[9px] font-black text-gray-400 uppercase">মোট সিট সংখ্যা</p>
                     <p className="font-black text-indigo-950 text-sm mt-0.5">{displayTotalSeats} টি আসন</p>
                   </div>
                   <div className="bg-white/90 p-2 rounded-xl border border-orange-100 sm:col-span-2">
                     <p className="text-[9px] font-black text-gray-400 uppercase">বরাদ্দকৃত সিট নম্বর</p>
                     <p className="font-black text-orange-600 text-sm mt-0.5 break-words whitespace-normal">{displaySeatString}</p>
                   </div>
                 </div>
               </div>
             )}

             {/* Official Ticket Card */}
             <div ref={ticketRef} className="bg-white border-2 border-dashed border-gray-300 rounded-[24px] sm:rounded-[32px] md:rounded-[36px] p-4 sm:p-5 md:p-6 mb-4 relative overflow-hidden shadow-sm">
                
                {/* Header of Ticket */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 pb-3 border-b border-gray-200">
                   <div className="flex items-center gap-2.5">
                      <img src={BUSINESS_INFO.logo} alt="Logo" className="h-9 sm:h-11 object-contain" />
                      <div>
                        <h4 className="text-sm sm:text-base font-black text-[#001D4A] tracking-tight leading-none">{BUSINESS_INFO.name}</h4>
                        <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 uppercase tracking-wider leading-tight mt-1">
                          {BUSINESS_INFO.address}
                        </p>
                      </div>
                   </div>
                   
                   {/* Seat Number Display - If > 4 seats, concise badge on top & dedicated banner below; else show directly */}
                   <div className="w-full sm:w-auto self-stretch sm:self-auto bg-[#001D4A] text-white px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl sm:rounded-2xl flex flex-col items-center sm:items-end justify-center shadow-md">
                     <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.15em] text-orange-400 leading-none mb-1">
                       {displayTotalSeats > 4 ? 'GROUP PASS' : (displayTotalSeats > 1 ? `SEATS (${displayTotalSeats})` : 'SEAT')}
                     </span>
                     <span className="text-base sm:text-lg md:text-xl font-black leading-tight text-amber-300 break-words whitespace-normal text-center sm:text-right max-w-full">
                       {displayTotalSeats > 4 ? `${displayTotalSeats} SEATS` : displaySeatString}
                     </span>
                   </div>
                </div>

                {/* Dedicated Allocated Seats Banner for > 4 Seats */}
                {displayTotalSeats > 4 && (
                  <div className="my-2.5 p-2.5 sm:p-3 bg-[#001D4A] rounded-xl sm:rounded-2xl text-white shadow-sm border border-orange-400/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 sm:gap-2">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse"></span>
                      <span className="text-[9px] sm:text-[10px] font-black uppercase text-orange-300 tracking-wider">
                        ALLOCATED SEATS ({displayTotalSeats}):
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm md:text-base font-black text-amber-300 break-words whitespace-normal leading-relaxed text-left sm:text-right font-mono">
                      {displaySeatString}
                    </p>
                  </div>
                )}

                {/* Passenger Information Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 py-1">
                   <div className="bg-gray-50/90 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-gray-100">
                       <p className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-wider mb-0.5">Primary Passenger</p>
                       <p className="text-sm sm:text-base font-black text-[#001D4A] break-words">{primaryBooking.name}</p>
                       <p className="text-[11px] text-gray-500 font-bold mt-0.5">
                         {info.gender || 'Male'} • {info.religion || 'Muslim'}
                       </p>
                   </div>

                   <div className="bg-gray-50/90 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-gray-100">
                       <p className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-wider mb-0.5">Contact Mobile</p>
                       <p className="text-sm sm:text-base font-black text-gray-900 tracking-wide break-words">+880{primaryBooking.mobile}</p>
                       <span className="text-[9px] text-emerald-600 font-bold">Verified Contact</span>
                   </div>

                   <div className="bg-indigo-50/70 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-indigo-100/70">
                       <p className="text-[9px] sm:text-[10px] font-black text-indigo-500 uppercase tracking-wider mb-0.5">Route / Tour</p>
                       <p className="text-xs sm:text-sm font-black text-indigo-950 break-words">{info.tourName || info.busNo}</p>
                   </div>

                   <div className="bg-emerald-50/70 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-emerald-100/70">
                       <p className="text-[9px] sm:text-[10px] font-black text-emerald-600 uppercase tracking-wider mb-0.5">Total Paid (Advance)</p>
                       <p className="text-sm sm:text-base font-black text-emerald-700">
                         ৳{(advancePaid || 0).toLocaleString()}
                       </p>
                   </div>
                </div>

                {/* QR Code & Status Footer */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-dashed border-gray-200 mt-3 pt-3">
                   <div className="flex items-center gap-3 w-full sm:w-auto">
                     <div className="p-1 bg-white rounded-xl border border-gray-200 shadow-sm shrink-0">
                       <img src={qrCodeUrl} alt="QR" className="w-14 h-14 sm:w-16 sm:h-16 object-contain" />
                     </div>
                     <div className="text-left min-w-0 flex-1">
                        <p className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase">Booked By</p>
                        <p className="text-xs sm:text-sm font-black text-gray-900 leading-tight truncate">
                          {info.bookedBy || 'System Admin'}
                        </p>
                        {agentPhone && (
                          <p className="text-[11px] font-bold text-indigo-700 mt-0.5 flex items-center gap-1">
                            <i className="fas fa-phone-alt text-[9px]"></i> +880{agentPhone}
                          </p>
                        )}
                        <p className="text-[9px] text-gray-400 font-bold mt-0.5">ID: {primaryBooking.id.slice(0, 8)}</p>
                     </div>
                   </div>

                   {/* Conditional Payment Status - STRICT CHECK */}
                   <div className="w-full sm:w-auto text-center sm:text-right shrink-0">
                      {isTrulyPaidFull ? (
                        <div className="px-4 py-2 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider bg-emerald-600 text-white shadow-md shadow-emerald-600/20 inline-flex items-center gap-1.5 justify-center w-full sm:w-auto">
                          <i className="fas fa-check-circle"></i>
                          <span>✓ PAID FULL</span>
                        </div>
                      ) : (
                        <div className="bg-rose-50 px-3.5 py-1.5 rounded-xl border border-rose-200 text-center sm:text-right w-full sm:w-auto">
                          <div className="flex items-center justify-between sm:justify-end gap-2">
                            <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${isUnpaid ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'}`}>
                              {isUnpaid ? 'UNPAID' : 'PARTIAL'}
                            </span>
                            <span className="text-[9px] font-black text-rose-500 uppercase">Remaining Due</span>
                          </div>
                          <p className="text-lg sm:text-xl font-black text-rose-600 leading-tight mt-0.5">
                            ৳{(remainingDue || 0).toLocaleString()}
                          </p>
                        </div>
                      )}
                   </div>
                </div>
             </div>

             {/* Action Buttons */}
             <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <button 
                    onClick={printTicket}
                    className="py-3 sm:py-3.5 bg-[#312e81] text-white rounded-2xl font-black text-xs sm:text-sm shadow-md shadow-indigo-100 flex items-center justify-center gap-1.5 transition-all active:scale-95 hover:bg-indigo-900"
                  >
                    <i className="fas fa-print"></i>
                    <span>{isGroup ? 'Print Pass' : 'Print Ticket'}</span>
                  </button>

                  <button 
                    onClick={handleShareTicket}
                    className="py-3 sm:py-3.5 bg-[#10a342] text-white rounded-2xl font-black text-xs sm:text-sm shadow-md shadow-green-100 flex items-center justify-center gap-1.5 transition-all active:scale-95 hover:bg-green-700"
                  >
                    <i className="fas fa-share-nodes"></i>
                    <span>Share Pass</span>
                  </button>
                  
                  <button 
                    onClick={onEdit}
                    disabled={!canEdit}
                    className={`py-3 sm:py-3.5 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 ${canEdit ? 'bg-[#eef5ff] text-[#3b82f6] hover:bg-blue-100' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}
                  >
                    <i className="fas fa-user-edit"></i>
                    <span>Edit Booking</span>
                  </button>

                  <button 
                    onClick={() => setShowPaymentModal(true)}
                    disabled={remainingDue <= 0 || !canEdit}
                    className={`py-3 sm:py-3.5 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-md ${remainingDue > 0 && canEdit ? 'bg-[#ff7a1a] text-white shadow-orange-100 hover:bg-orange-600' : 'bg-gray-100 text-gray-300 cursor-not-allowed shadow-none'}`}
                  >
                    <i className="fas fa-money-bill-wave"></i>
                    <span>Due Pay {remainingDue > 0 ? `৳${remainingDue}` : ''}</span>
                  </button>
                </div>

                {isAdmin && (
                  <button 
                    onClick={onCancel}
                    className="w-full py-3 bg-[#fff1f1] text-red-500 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-1.5 hover:bg-red-100"
                  >
                    <i className="fas fa-trash-alt"></i>
                    <span>Cancel Booking Permanently</span>
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
