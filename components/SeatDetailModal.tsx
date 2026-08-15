
import React, { useRef, useState } from 'react';
import { BookingInfo } from '../types';
import { BUSINESS_INFO } from '../constants';
import PaymentModal from './PaymentModal';

interface SeatDetailModalProps {
  info: BookingInfo;
  onClose: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onUpdate?: (updatedInfo: BookingInfo) => void;
  isAdmin?: boolean;
  currentAgentCode?: string;
  notify?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const SeatDetailModal: React.FC<SeatDetailModalProps> = ({ info, onClose, onEdit, onCancel, onUpdate, isAdmin, currentAgentCode, notify }) => {
  const ticketRef = useRef<HTMLDivElement>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const canEdit = isAdmin || info.bookerCode.toUpperCase() === currentAgentCode?.toUpperCase();

  const qrData = `ID:${info.id}|Seat:${info.seatNo}|Name:${info.name}|Tour:${info.tourName}`;
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
    const totalAmount = info.tourFees + (info.customerTypeFees || 0);
    const message = `
🎫 *${BUSINESS_INFO.name} - Official Ticket*
---------------------------------------
👤 *Passenger:* ${info.name}
📍 *Tour:* ${info.tourName}
💺 *Seat Number:* ${info.seatNo}
📞 *Contact:* +880${info.mobile}

💰 *Ticket Price:* ৳${totalAmount.toLocaleString()}
💵 *Advance Paid:* ৳${info.advanceAmount.toLocaleString()}
🔴 *Due Balance:* ৳${info.dueAmount.toLocaleString()}
✅ *Status:* ${info.paymentStatus}

🆔 *Booking ID:* ${info.id}
📝 *Booked By:* ${info.bookedBy}
📅 *Date:* ${new Date(info.bookingDate).toLocaleDateString()}
---------------------------------------
*Thank you for choosing ${BUSINESS_INFO.name}!*
📍 ${BUSINESS_INFO.address}
`.trim();

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Ticket for ${info.name}`,
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
            <title>Ticket - ${info.name}</title>
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
             <div className="flex justify-between items-start mb-6 px-2">
                <div>
                  <span className="text-[10px] font-black text-white bg-indigo-600 px-4 py-1 rounded-full uppercase mb-3 inline-block tracking-widest shadow-lg">Cloud Registry</span>
                  <h3 className="text-3xl md:text-5xl font-black text-[#001D4A] tracking-tighter leading-none truncate max-w-[300px]">{info.name}</h3>
                </div>
                <button onClick={onClose} className="w-10 h-10 md:w-12 md:h-12 bg-gray-50 rounded-full flex items-center justify-center transition-all text-gray-400 active:scale-90">
                  <i className="fas fa-times text-xl"></i>
                </button>
             </div>

             <div ref={ticketRef} className="bg-white border-2 border-dashed border-gray-200 rounded-[30px] md:rounded-[40px] p-6 md:p-8 mb-8 relative overflow-hidden shadow-sm">
                <div className="absolute -left-5 top-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full border-r-2 border-dashed border-gray-200 z-10"></div>
                <div className="absolute -right-5 top-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full border-l-2 border-dashed border-gray-200 z-10"></div>
                
                <div className="flex justify-between items-start mb-8">
                   <div>
                      <img src={BUSINESS_INFO.logo} alt="Logo" className="h-10 md:h-12 mb-3" />
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest max-w-[200px] leading-relaxed">
                        {BUSINESS_INFO.address}
                      </p>
                   </div>
                   <div className="text-right">
                      <div className="bg-[#001D4A] text-white px-5 py-2 md:px-6 md:py-3 rounded-2xl flex flex-col items-center shadow-xl shadow-indigo-100/50">
                        <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Seat</span>
                        <span className="text-2xl md:text-4xl font-black leading-none">{info.seatNo}</span>
                      </div>
                   </div>
                </div>

                <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-center border-t border-dashed border-gray-100 pt-6">
                   <div className="flex-grow grid grid-cols-2 gap-y-6 md:gap-y-8 gap-x-4 w-full text-left">
                      <div>
                          <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Route</p>
                          <p className="text-sm md:text-base font-black text-[#001D4A] truncate">{info.tourName}</p>
                      </div>
                      <div>
                          <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Contact</p>
                          <p className="text-sm md:text-base font-black text-gray-700">+880{info.mobile}</p>
                      </div>
                      <div>
                          <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Advanced</p>
                          <p className="text-sm md:text-base font-black text-green-600">৳{info.advanceAmount.toLocaleString()}</p>
                      </div>
                      <div>
                          <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Status</p>
                          <p className={`text-sm md:text-base font-black uppercase tracking-widest ${info.paymentStatus === 'Paid' ? 'text-green-600' : 'text-orange-500'}`}>
                            {info.paymentStatus}
                          </p>
                      </div>
                   </div>
                   
                   <div className="shrink-0 flex flex-col items-center">
                      <img src={qrCodeUrl} alt="QR" className="w-24 h-24 md:w-28 md:h-28" />
                      <p className="text-[8px] font-black text-gray-300 uppercase mt-2 tracking-tighter">ID: {info.id}</p>
                   </div>
                </div>

                <div className="border-t border-dashed border-gray-100 my-6 pt-6 flex justify-between items-end">
                   <div className="text-left">
                      <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Agent Details</p>
                      <p className="text-[12px] md:text-sm font-black text-gray-800 uppercase leading-none">{info.bookedBy}</p>
                   </div>
                   <div className="text-right">
                      {info.dueAmount > 0 && (
                        <div>
                          <p className="text-[9px] md:text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">Remaining Due</p>
                          <p className="text-2xl md:text-3xl font-black text-red-600 leading-none">৳{info.dueAmount.toLocaleString()}</p>
                        </div>
                      )}
                   </div>
                </div>
             </div>

             <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={printTicket}
                    className="py-4 md:py-5 bg-[#312e81] text-white rounded-[32px] md:rounded-[40px] font-black text-sm md:text-base shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    <i className="fas fa-print"></i> Print
                  </button>

                  <button 
                    onClick={handleShareTicket}
                    className="py-4 md:py-5 bg-[#10a342] text-white rounded-[32px] md:rounded-[40px] font-black text-sm md:text-base shadow-xl shadow-green-100 flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    <i className="fas fa-share-nodes"></i> Share
                  </button>
                  
                  <button 
                    onClick={onEdit}
                    disabled={!canEdit}
                    className={`py-4 md:py-5 rounded-[32px] md:rounded-[40px] font-black text-sm md:text-base flex items-center justify-center gap-2 transition-all active:scale-95 ${canEdit ? 'bg-[#eef5ff] text-[#3b82f6]' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}
                  >
                    <i className="fas fa-user-edit"></i> Edit
                  </button>

                  <button 
                    onClick={() => setShowPaymentModal(true)}
                    disabled={info.dueAmount <= 0 || !canEdit}
                    className={`py-4 md:py-5 rounded-[32px] md:rounded-[40px] font-black text-sm md:text-base flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xl ${info.dueAmount > 0 && canEdit ? 'bg-[#ff7a1a] text-white shadow-orange-100' : 'bg-gray-100 text-gray-300 cursor-not-allowed shadow-none'}`}
                  >
                    <i className="fas fa-money-bill-wave"></i> Due Pay ৳{info.dueAmount}
                  </button>
                </div>

                {isAdmin && (
                  <button 
                    onClick={onCancel}
                    className="w-full py-4 bg-[#fff1f1] text-red-500 rounded-[32px] md:rounded-[40px] font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
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
