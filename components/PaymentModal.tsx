
import React, { useState } from 'react';
import { BookingInfo } from '../types';

interface PaymentModalProps {
  info: BookingInfo;
  onClose: () => void;
  onConfirm: (amount: number) => void;
  isAdmin?: boolean;
  notify?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ info, onClose, onConfirm, isAdmin, notify }) => {
  // If admin, start directly at the 'amount' step
  const [step, setStep] = useState<'verify' | 'amount'>(isAdmin ? 'amount' : 'verify');
  const [code, setCode] = useState('');
  const [amount, setAmount] = useState<string>(info.dueAmount.toString());

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.toUpperCase() === info.bookerCode.toUpperCase()) {
      setStep('amount');
    } else {
      notify?.("Unauthorized Agent Code!", 'error');
    }
  };

  const handleSettle = (e: React.FormEvent) => {
    e.preventDefault();
    const payValue = parseFloat(amount);
    if (!isNaN(payValue) && payValue > 0) {
      if (payValue > info.dueAmount) {
        notify?.(`Error: Cannot pay more than the due amount (৳${info.dueAmount})`, 'error');
        return;
      }
      onConfirm(payValue);
    } else {
      notify?.("Please enter a valid amount.", 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[#001D4A]/90 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-sm rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
        
        {/* Header with Step Indicator */}
        <div className="p-8 pb-0 text-center">
          <div className="flex justify-center gap-2 mb-4">
            <div className={`h-1.5 w-12 rounded-full transition-all ${step === 'verify' ? 'bg-orange-500' : 'bg-green-500'}`}></div>
            <div className={`h-1.5 w-12 rounded-full transition-all ${step === 'amount' ? 'bg-orange-500' : 'bg-gray-100'}`}></div>
          </div>
          <h3 className="text-2xl font-black text-[#001D4A] tracking-tighter uppercase">
            {step === 'verify' ? 'Verify Agent' : 'Due Settlement'}
          </h3>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
            {step === 'verify' ? 'Authorization Required' : `Remaining: ৳${info.dueAmount}`}
          </p>
        </div>

        <div className="p-8">
          {step === 'verify' ? (
            <form onSubmit={handleVerify} className="space-y-6">
              <div className="bg-indigo-50 p-6 rounded-[24px] text-center border border-indigo-100">
                <i className="fas fa-shield-halved text-3xl text-indigo-600 mb-3"></i>
                <p className="text-xs font-bold text-indigo-900/60 leading-relaxed uppercase tracking-tighter">
                  Enter code for<br/><span className="text-indigo-600 font-black">{info.bookedBy}</span>
                </p>
              </div>
              <input 
                autoFocus
                type="text" 
                placeholder="AGENT CODE" 
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full px-5 py-5 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none font-black text-center text-xl tracking-widest uppercase"
              />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} className="flex-1 py-4 text-gray-400 font-black text-sm uppercase">Cancel</button>
                <button type="submit" className="flex-1 py-4 bg-[#001D4A] text-white rounded-2xl font-black text-sm uppercase shadow-xl shadow-indigo-100 active:scale-95 transition-all">Verify</button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSettle} className="space-y-6">
              <div className="bg-orange-50 p-6 rounded-[24px] flex flex-col items-center border border-orange-100">
                <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1">Current Balance Due</span>
                <span className="text-4xl font-black text-orange-600 tracking-tighter">৳{info.dueAmount.toLocaleString()}</span>
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Amount to Pay</label>
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300 font-black text-xl">৳</span>
                  <input 
                    autoFocus
                    type="number" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full pl-12 pr-6 py-5 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-green-500 outline-none font-black text-2xl"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => !isAdmin ? setStep('verify') : onClose()} className="flex-1 py-4 text-gray-400 font-black text-sm uppercase">{!isAdmin ? 'Back' : 'Cancel'}</button>
                <button type="submit" className="flex-1 py-4 bg-green-600 text-white rounded-2xl font-black text-sm uppercase shadow-xl shadow-green-100 active:scale-95 transition-all">Confirm Pay</button>
              </div>
            </form>
          )}
        </div>

        <div className="bg-gray-50 p-4 text-center border-t border-gray-100">
          <p className="text-[8px] font-black text-gray-300 uppercase tracking-[0.3em]">Transaction Secured by Cloud</p>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
