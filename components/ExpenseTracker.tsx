
import React, { useState, useMemo } from 'react';
import { Expense, Booker, Tour } from '../types';

interface ExpenseTrackerProps {
  expenses: Expense[];
  onSubmit: (expense: Expense) => void;
  onDelete: (id: string) => void;
  bookers: Booker[];
  initialAgentCode?: string;
  tours: Tour[];
  isAdmin?: boolean;
  notify?: (msg: string, type: 'success' | 'error' | 'info') => void;
  requestConfirm?: (msg: string, action: () => void) => void;
}

const EXPENSE_CATEGORIES = [
  'Bus Rent',
  'Fuel/Gas',
  'Food/Catering',
  'Hotel/Accommodation',
  'Marketing/Ads',
  'Agent Commission',
  'Office Rent',
  'Staff Salary',
  'Misc Repairs',
  'Others'
];

const ExpenseTracker: React.FC<ExpenseTrackerProps> = ({ expenses, onSubmit, onDelete, bookers, initialAgentCode, tours, isAdmin, notify, requestConfirm }) => {
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    category: EXPENSE_CATEGORIES[0],
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    agentCode: initialAgentCode || '',
    tourName: ''
  });

  const [listFilterTour, setListFilterTour] = useState('');

  const filteredExpenses = useMemo(() => {
    if (!listFilterTour) return expenses;
    return expenses.filter(ex => ex.tourName === listFilterTour);
  }, [expenses, listFilterTour]);

  const handleEdit = (ex: Expense) => {
    if (!isAdmin) return;
    setEditId(ex.id);
    setFormData({
      category: ex.category,
      amount: ex.amount.toString(),
      description: ex.description || '',
      date: ex.date,
      agentCode: ex.agentCode || initialAgentCode || '',
      tourName: ex.tourName || ''
    });
    // Smooth scroll to the form for better UX on mobile
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setEditId(null);
    setFormData({
      category: EXPENSE_CATEGORIES[0],
      amount: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      agentCode: initialAgentCode || '',
      tourName: ''
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let recorderName = 'System Admin';
    let finalAgentCode = 'ADMIN';

    // Verification for non-admin entries
    if (formData.agentCode !== "@Rana&01625@" && formData.agentCode !== "ADMIN") {
      const booker = bookers.find(b => b.code.toUpperCase() === formData.agentCode.toUpperCase());
      if (!booker) {
        notify?.("Invalid Agent Code. Please use a registered code.", 'error');
        return;
      }
      recorderName = booker.name;
      finalAgentCode = booker.code;
    }

    const expensePayload: Expense = {
      // If editId exists, we pass it to Supabase so it performs an UPDATE instead of INSERT
      id: editId || Math.random().toString(36).substr(2, 9).toUpperCase(),
      category: formData.category,
      amount: parseFloat(formData.amount),
      description: formData.description,
      date: formData.date,
      recordedBy: recorderName,
      agentCode: finalAgentCode,
      tourName: formData.tourName || undefined
    };

    onSubmit(expensePayload);
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (!isAdmin) {
      notify?.("Unauthorized: Only Admins can delete financial records.", 'error');
      return;
    }
    
    const confirmDelete = () => {
      onDelete(id);
      if (editId === id) resetForm();
      notify?.("Expense record deleted.", 'success');
    };

    if (requestConfirm) {
      requestConfirm("Permanently delete this expense record? This action cannot be undone.", confirmDelete);
    } else if (window.confirm("Permanently delete this expense record? This action cannot be undone.")) {
      confirmDelete();
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto md:pl-12 pb-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Input Form Column */}
        <div className="lg:col-span-5">
          <div className={`bg-white p-6 md:p-10 rounded-[32px] shadow-sm border transition-all duration-300 h-fit sticky top-6 ${editId ? 'border-blue-500 ring-4 ring-blue-50' : 'border-gray-100'}`}>
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 ${editId ? 'bg-blue-600' : 'bg-[#001D4A]'} text-white rounded-2xl flex items-center justify-center shadow-lg transition-colors`}>
                  <i className={`fas ${editId ? 'fa-pen-to-square' : 'fa-file-invoice-dollar'} text-lg`}></i>
                </div>
                <div>
                  <h3 className={`text-xl font-black tracking-tighter uppercase leading-none ${editId ? 'text-blue-600' : 'text-[#001D4A]'}`}>
                    {editId ? 'Update Cost' : 'Expense Entry'}
                  </h3>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                    {editId ? 'Modifying existing record' : 'Register new business cost'}
                  </p>
                </div>
              </div>
              {editId && (
                <button onClick={resetForm} className="px-3 py-1.5 bg-gray-100 text-[9px] font-black text-gray-500 rounded-lg uppercase tracking-widest transition-all">
                  Cancel
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Expense Type</label>
                <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl font-black text-xs text-[#001D4A] uppercase outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all">
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Route Connection (Optional)</label>
                <select value={formData.tourName} onChange={e => setFormData({...formData, tourName: e.target.value})} className="w-full px-5 py-4 bg-indigo-50 border-none rounded-2xl font-black text-xs text-indigo-600 uppercase outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all">
                  <option value="">General / Office Expense</option>
                  {tours.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Amount</label>
                  <input required type="number" inputMode="numeric" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl font-black text-sm text-red-600 outline-none focus:ring-2 focus:ring-red-500/20" placeholder="৳" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Record Date</label>
                  <input required type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl font-black text-xs outline-none focus:ring-2 focus:ring-indigo-500/20" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Memo / Description</label>
                <input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500/20" placeholder="e.g. Paid advanced for Scania Bus" />
              </div>

              <div className="space-y-1">
                 <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Security PIN / Agent Code</label>
                 <input required placeholder="YOUR CODE" value={formData.agentCode} onChange={e => setFormData({...formData, agentCode: e.target.value.toUpperCase()})} className={`w-full px-5 py-4 border-2 rounded-2xl font-black text-center text-sm tracking-widest uppercase transition-all outline-none ${initialAgentCode === 'ADMIN' ? 'bg-indigo-50 border-indigo-400 text-indigo-700' : 'bg-white border-gray-100 focus:border-indigo-500'}`} />
              </div>

              <button type="submit" className={`w-full py-5 ${editId ? 'bg-blue-600 shadow-blue-100' : 'bg-[#001D4A] shadow-indigo-100'} text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl active:scale-95 transition-all mt-4`}>
                {editId ? 'Update Record' : 'Submit Expense'}
              </button>
            </form>
          </div>
        </div>

        {/* History List Column */}
        <div className="lg:col-span-7 space-y-4">
           <div className="flex justify-between items-center px-4">
              <div>
                <h3 className="text-xs font-black text-[#001D4A] uppercase tracking-widest">Recent Activity</h3>
                <p className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">Live cost audit log</p>
              </div>
              <div className="flex items-center gap-3">
                <i className="fas fa-filter text-gray-300 text-xs"></i>
                <select value={listFilterTour} onChange={e => setListFilterTour(e.target.value)} className="bg-white px-4 py-2 rounded-xl text-[10px] font-black uppercase text-indigo-600 border border-gray-100 shadow-sm outline-none">
                  <option value="">All Business Costs</option>
                  {tours.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                </select>
              </div>
           </div>
           
           <div className="space-y-3">
              {filteredExpenses.map(ex => (
                <div key={ex.id} className={`bg-white p-5 rounded-[32px] shadow-sm border transition-all group ${editId === ex.id ? 'border-blue-500 ring-2 ring-blue-50' : 'border-gray-50'} flex items-center justify-between`}>
                   <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 ${editId === ex.id ? 'bg-blue-600 text-white' : 'bg-red-50 text-red-500'} rounded-2xl flex items-center justify-center text-sm transition-all`}>
                        <i className="fas fa-receipt"></i>
                      </div>
                      <div className="min-w-0">
                         <div className="flex items-center gap-2 mb-1">
                            <span className="text-[8px] font-black bg-gray-100 text-gray-500 px-2 py-0.5 rounded uppercase tracking-tighter">{ex.category}</span>
                            {ex.tourName && <span className="text-[8px] font-black bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded uppercase tracking-tighter">{ex.tourName}</span>}
                         </div>
                         <p className="font-black text-[#001D4A] text-xs truncate max-w-[180px] md:max-w-[250px]">{ex.description || 'No description provided'}</p>
                         <div className="flex items-center gap-2 mt-1">
                            <p className="text-[8px] font-black text-gray-300 uppercase">{new Date(ex.date).toLocaleDateString('en-GB')}</p>
                            <span className="text-gray-200 text-[8px]">•</span>
                            <p className="text-[8px] font-black text-gray-400 uppercase">Recorded by: {ex.recordedBy}</p>
                         </div>
                      </div>
                   </div>
                   
                   <div className="flex items-center gap-3 shrink-0">
                      <p className="text-sm md:text-base font-black text-red-600">৳{ex.amount.toLocaleString()}</p>
                      
                      {isAdmin && (
                        <div className="flex items-center gap-1.5 ml-2">
                          <button 
                            onClick={() => handleEdit(ex)} 
                            className="w-9 h-9 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center active:scale-90 transition-all hidden md:flex"
                            title="Edit Record"
                          >
                            <i className="fas fa-edit text-[11px]"></i>
                          </button>
                          <button 
                            onClick={() => handleDelete(ex.id)} 
                            className="w-9 h-9 bg-red-50 text-red-500 rounded-xl flex items-center justify-center active:scale-90 transition-all hidden md:flex"
                            title="Delete Record"
                          >
                            <i className="fas fa-trash-alt text-[11px]"></i>
                          </button>
                          
                          {/* Mobile Always Visible Controls */}
                          <div className="md:hidden flex gap-1.5">
                            <button onClick={() => handleEdit(ex)} className="w-8 h-8 bg-blue-50 text-blue-500 rounded-lg flex items-center justify-center active:scale-95"><i className="fas fa-edit text-[10px]"></i></button>
                            <button onClick={() => handleDelete(ex.id)} className="w-8 h-8 bg-red-50 text-red-500 rounded-lg flex items-center justify-center active:scale-95"><i className="fas fa-trash-alt text-[10px]"></i></button>
                          </div>
                        </div>
                      )}
                   </div>
                </div>
              ))}
              
              {filteredExpenses.length === 0 && (
                <div className="py-24 text-center bg-white rounded-[40px] border-2 border-dashed border-gray-100">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-file-invoice text-gray-200 text-xl"></i>
                  </div>
                  <p className="text-gray-400 font-black uppercase text-[10px] tracking-widest">No transaction records found</p>
                  <p className="text-[9px] text-gray-300 font-bold uppercase mt-1">Select another filter or add new entry</p>
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default ExpenseTracker;
