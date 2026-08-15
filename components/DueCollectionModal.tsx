import React, { useState } from 'react';
import { BookingInfo } from '../types';

export interface GroupedBookingBilling {
  id: string; // primary booking ID / group ID
  leadBooking: BookingInfo;
  passengers: BookingInfo[];
  seatsList: string[];
  totalSeats: number;
  totalTourFees: number;
  totalCustomerTypeFees: number;
  totalDiscount: number;
  totalGrossAmount: number;
  totalAdvance: number;
  totalDue: number;
  isPaidFull: boolean;
  agentName: string;
  agentCode: string;
  bookingDate: string;
}

interface DueCollectionModalProps {
  group: GroupedBookingBilling;
  onClose: () => void;
  onSettle: (collectedAmount: number) => Promise<void>;
  isAdmin?: boolean;
}

export const DueCollectionModal: React.FC<DueCollectionModalProps> = ({
  group,
  onClose,
  onSettle,
  isAdmin
}) => {
  const [payAmount, setPayAmount] = useState<string>(group.totalDue.toString());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) {
      setErrorMsg('সঠিক পেমেন্ট অ্যামাউন্ট (৳) লিখুন।');
      return;
    }
    if (amt > group.totalDue) {
      setErrorMsg(`বকেয়ার চেয়ে বেশি গ্রহণ করা যাবে না (সর্বোচ্চ: ৳${(group.totalDue || 0).toLocaleString()})`);
      return;
    }

    try {
      setIsSubmitting(true);
      await onSettle(amt);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'বকেয়া ক্লিয়ার করতে সমস্যা হয়েছে।');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-[#001D4A]/85 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-md rounded-[36px] shadow-2xl overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-6 md:p-8 pb-4 text-center bg-gradient-to-b from-orange-50/50 to-white">
          <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-3 text-xl shadow-sm">
            <i className="fas fa-hand-holding-dollar"></i>
          </div>
          <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest bg-orange-50 px-3 py-1 rounded-full inline-block mb-1">
            বকেয়া পরিশোধ (Due Collection)
          </span>
          <h3 className="text-xl md:text-2xl font-black text-[#001D4A] tracking-tight">
            {group.leadBooking.name}
          </h3>
          <p className="text-xs font-bold text-gray-500 mt-1 flex items-center justify-center gap-1.5">
            <span>+880{group.leadBooking.mobile}</span>
            <span>•</span>
            <span className="text-indigo-600 font-extrabold">{group.seatsList.length > 1 ? `Seats: ${group.seatsList.join(', ')}` : `Seat: ${group.leadBooking.seatNo}`}</span>
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 md:p-8 pt-2 space-y-5">
          
          {/* Summary Box */}
          <div className="grid grid-cols-2 gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-100">
            <div>
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">বর্তমান বকেয়া (Total Due)</span>
              <span className="text-xl font-black text-rose-600">৳{(group.totalDue || 0).toLocaleString()}</span>
            </div>
            <div>
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">পূর্বের অগ্রিম (Paid)</span>
              <span className="text-xl font-black text-emerald-600">৳{(group.totalAdvance || 0).toLocaleString()}</span>
            </div>
          </div>

          {/* Quick Pay Buttons */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider ml-1 block">Quick Amount Selection</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPayAmount((group.totalDue || 0).toString())}
                className="flex-1 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-black uppercase transition-all"
              >
                Full Due (৳{(group.totalDue || 0).toLocaleString()})
              </button>
              {group.totalDue > 500 && (
                <button
                  type="button"
                  onClick={() => setPayAmount(Math.round((group.totalDue || 0) / 2).toString())}
                  className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-xl text-xs font-black uppercase transition-all"
                >
                  Half (৳{Math.round((group.totalDue || 0) / 2).toLocaleString()})
                </button>
              )}
            </div>
          </div>

          {/* Input Field */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider ml-1 flex items-center justify-between">
              <span>প্যাসেঞ্জার থেকে গৃহীত টাকার পরিমাণ (৳)</span>
              <span className="text-indigo-600 font-bold">Max: ৳{group.totalDue}</span>
            </label>
            <div className="relative">
              <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-gray-400 text-lg">৳</span>
              <input
                autoFocus
                type="number"
                inputMode="numeric"
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                placeholder="0"
                className="w-full pl-11 pr-5 py-4 bg-gray-50 border-2 border-indigo-100 focus:border-indigo-500 focus:bg-white rounded-2xl font-black text-xl text-[#001D4A] outline-none transition-all"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-2">
              <i className="fas fa-exclamation-circle"></i>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-4 text-gray-400 font-black text-xs uppercase hover:text-gray-600 transition-colors"
            >
              বাতিল (Cancel)
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-4 bg-[#001D4A] hover:bg-[#002868] text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-indigo-950/20 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <span>আপডেট হচ্ছে...</span>
              ) : (
                <>
                  <i className="fas fa-check-circle"></i>
                  <span>বকেয়া ক্লিয়ার করুন</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
