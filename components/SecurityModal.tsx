
import React, { useState } from 'react';
import { BookingInfo } from '../types';

interface SecurityModalProps {
  info: BookingInfo;
  action: 'edit' | 'delete';
  onClose: () => void;
  onVerify: (code: string) => void;
}

const SecurityModal: React.FC<SecurityModalProps> = ({ info, action, onClose, onVerify }) => {
  const [code, setCode] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onVerify(code);
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-[#001D4A]/80 backdrop-blur-md">
      <div className="bg-white w-full max-w-sm rounded-[32px] p-8 shadow-2xl animate-in zoom-in duration-300">
        <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 text-2xl">
          <i className={`fas ${action === 'edit' ? 'fa-user-edit' : 'fa-user-lock'}`}></i>
        </div>
        
        <h3 className="text-xl font-black text-[#001D4A] mb-2 text-center uppercase tracking-tight">Agent Verification</h3>
        <p className="text-xs text-gray-400 text-center mb-8 leading-relaxed">
          Enter the <span className="font-bold text-indigo-600">Agent Code</span> for <span className="font-bold">{info.bookedBy}</span> to authorize this {action}.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <input 
            autoFocus
            type="text" 
            placeholder="AGENT CODE" 
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-black text-center text-lg tracking-widest uppercase"
          />
          
          <div className="flex gap-3">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 py-4 text-gray-500 font-bold rounded-2xl transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="flex-1 py-4 bg-[#001D4A] text-white rounded-2xl font-black shadow-lg transition-all active:scale-95"
            >
              Verify
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SecurityModal;
