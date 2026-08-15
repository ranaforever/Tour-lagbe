import React, { useState } from 'react';
import { BusCustomLayout, Tour } from '../types';
import { BUS_LAYOUT_PRESETS, DEFAULT_BUS_LAYOUT } from '../constants';

interface BusLayoutEditorProps {
  currentLayout: BusCustomLayout;
  tours: Tour[];
  selectedTour: string;
  onSaveLayout: (layout: BusCustomLayout, applyToTour?: string) => void;
  notify?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const BusLayoutEditor: React.FC<BusLayoutEditorProps> = ({
  currentLayout,
  tours,
  selectedTour,
  onSaveLayout,
  notify
}) => {
  const [layout, setLayout] = useState<BusCustomLayout>({
    ...DEFAULT_BUS_LAYOUT,
    ...currentLayout,
    disabledSeats: currentLayout?.disabledSeats || [],
    customLabels: currentLayout?.customLabels || {}
  });

  const [applyTour, setApplyTour] = useState<string>(selectedTour || '');
  const [editingSeatId, setEditingSeatId] = useState<string | null>(null);
  const [customLabelInput, setCustomLabelInput] = useState<string>('');

  const rowLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

  const handleApplyPreset = (preset: BusCustomLayout) => {
    setLayout({
      ...preset,
      disabledSeats: [],
      customLabels: {}
    });
    notify?.(`Applied preset: ${preset.name}`, 'info');
  };

  const handleLeftColsChange = (cols: number) => {
    setLayout(prev => ({ ...prev, leftColumns: cols }));
  };

  const handleRightColsChange = (cols: number) => {
    setLayout(prev => ({ ...prev, rightColumns: cols }));
  };

  const handleRowCountChange = (count: number) => {
    const newRows = rowLetters.slice(0, count);
    const rearLetter = rowLetters[count] || 'Z';
    setLayout(prev => ({
      ...prev,
      rows: newRows,
      rearRowLetter: rearLetter
    }));
  };

  const toggleSeatDisabled = (seatId: string) => {
    setLayout(prev => {
      const isDisabled = prev.disabledSeats.includes(seatId);
      const updated = isDisabled
        ? prev.disabledSeats.filter(id => id !== seatId)
        : [...prev.disabledSeats, seatId];
      return { ...prev, disabledSeats: updated };
    });
  };

  const openLabelEdit = (seatId: string, currentLabel?: string) => {
    setEditingSeatId(seatId);
    setCustomLabelInput(currentLabel || seatId);
  };

  const saveCustomLabel = () => {
    if (!editingSeatId) return;
    setLayout(prev => ({
      ...prev,
      customLabels: {
        ...(prev.customLabels || {}),
        [editingSeatId]: customLabelInput.trim() || editingSeatId
      }
    }));
    setEditingSeatId(null);
  };

  // Calculate active seats count
  const totalGridSeats = (layout.rows.length * (layout.leftColumns + layout.rightColumns)) +
    (layout.hasRearBench ? layout.rearBenchSeats : 0);
  const activeSeatsCount = totalGridSeats - (layout.disabledSeats?.length || 0);

  const handleSave = () => {
    onSaveLayout(layout, applyTour || undefined);
    notify?.("Bus layout configuration saved successfully!", 'success');
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header card */}
      <div className="bg-white p-6 md:p-8 rounded-[32px] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest bg-orange-50 px-3 py-1 rounded-full">
            Layout Customizer
          </span>
          <h3 className="text-2xl font-black text-[#001D4A] mt-2">বাস সিট লেআউট এডিটর (Bus Layout Editor)</h3>
          <p className="text-gray-400 text-xs font-bold mt-1">
            আপনার বাসের সারি, কলাম, পেছনের সিট এবং খালি জায়গা প্রয়োজনমতো কাস্টমাইজ করুন।
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={handleSave}
            className="w-full md:w-auto px-6 py-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-orange-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <i className="fas fa-save"></i>
            <span>লেআউট সংরক্ষণ করুন (Save Layout)</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Side: Layout Settings Form */}
        <div className="lg:col-span-5 space-y-6">
          {/* Preset Buttons */}
          <div className="bg-white p-6 rounded-[28px] border border-gray-100 shadow-sm space-y-4">
            <h4 className="font-black text-[#001D4A] text-xs uppercase tracking-wider flex items-center gap-2">
              <i className="fas fa-magic text-indigo-500"></i>
              রেডিমেড প্রিসেট (Quick Presets)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {BUS_LAYOUT_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => handleApplyPreset(preset)}
                  className={`p-3 rounded-2xl text-left border text-xs font-black transition-all ${
                    layout.name === preset.name
                      ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 shadow-sm'
                      : 'border-gray-100 hover:border-gray-300 text-gray-700 bg-gray-50/50'
                  }`}
                >
                  <p className="font-black text-[11px] truncate">{preset.name}</p>
                  <span className="text-[9px] text-gray-400 font-bold block mt-0.5">
                    {preset.leftColumns}x{preset.rightColumns} • {preset.rows.length} Rows
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Configuration Controls */}
          <div className="bg-white p-6 rounded-[28px] border border-gray-100 shadow-sm space-y-5">
            <h4 className="font-black text-[#001D4A] text-xs uppercase tracking-wider flex items-center gap-2">
              <i className="fas fa-sliders-h text-orange-500"></i>
              লেআউট কনফিগারেশন (Configuration)
            </h4>

            <div className="space-y-4">
              {/* Layout Name */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                  Layout Name
                </label>
                <input
                  type="text"
                  value={layout.name}
                  onChange={(e) => setLayout(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl text-xs font-bold text-[#001D4A] outline-none"
                  placeholder="e.g. Standard 45 Seats"
                />
              </div>

              {/* Target Tour */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                  Apply To Tour
                </label>
                <select
                  value={applyTour}
                  onChange={(e) => setApplyTour(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl text-xs font-black text-indigo-700 uppercase outline-none"
                >
                  <option value="">All Tours (Global Default)</option>
                  {tours.map(t => (
                    <option key={t.name} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Row Count */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                    Rows Count (সারির সংখ্যা): {layout.rows.length} Rows
                  </label>
                  <span className="text-[10px] font-black text-indigo-600">
                    {layout.rows[0]} to {layout.rows[layout.rows.length - 1]}
                  </span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="12"
                  value={layout.rows.length}
                  onChange={(e) => handleRowCountChange(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
                <div className="flex justify-between text-[9px] font-bold text-gray-400">
                  <span>4 (Mini)</span>
                  <span>8</span>
                  <span>10 (Standard)</span>
                  <span>12 (Long)</span>
                </div>
              </div>

              {/* Columns: Left and Right */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                    Left Columns
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleLeftColsChange(1)}
                      className={`py-2 rounded-xl text-xs font-black transition-all ${
                        layout.leftColumns === 1
                          ? 'bg-[#001D4A] text-white'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      1 Col (VIP)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLeftColsChange(2)}
                      className={`py-2 rounded-xl text-xs font-black transition-all ${
                        layout.leftColumns === 2
                          ? 'bg-[#001D4A] text-white'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      2 Cols
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                    Right Columns
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleRightColsChange(1)}
                      className={`py-2 rounded-xl text-xs font-black transition-all ${
                        layout.rightColumns === 1
                          ? 'bg-[#001D4A] text-white'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      1 Col (VIP)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRightColsChange(2)}
                      className={`py-2 rounded-xl text-xs font-black transition-all ${
                        layout.rightColumns === 2
                          ? 'bg-[#001D4A] text-white'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      2 Cols
                    </button>
                  </div>
                </div>
              </div>

              {/* Rear Bench Configuration */}
              <div className="pt-2 border-t border-gray-100 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-gray-700 uppercase tracking-wider">
                    Rear Bench Seating (পেছনের সিট)
                  </label>
                  <input
                    type="checkbox"
                    checked={layout.hasRearBench}
                    onChange={(e) => setLayout(prev => ({ ...prev, hasRearBench: e.target.checked }))}
                    className="w-5 h-5 rounded-md text-orange-500 focus:ring-orange-400 cursor-pointer"
                  />
                </div>

                {layout.hasRearBench && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                        Rear Seats Count
                      </label>
                      <select
                        value={layout.rearBenchSeats}
                        onChange={(e) => setLayout(prev => ({ ...prev, rearBenchSeats: Number(e.target.value) }))}
                        className="w-full px-3 py-2 bg-gray-50 rounded-xl text-xs font-black text-[#001D4A]"
                      >
                        <option value={4}>4 Seats</option>
                        <option value={5}>5 Seats (Standard)</option>
                        <option value={6}>6 Seats</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                        Row Letter
                      </label>
                      <input
                        type="text"
                        maxLength={2}
                        value={layout.rearRowLetter}
                        onChange={(e) => setLayout(prev => ({ ...prev, rearRowLetter: e.target.value.toUpperCase() }))}
                        className="w-full px-3 py-2 bg-gray-50 rounded-xl text-xs font-black text-center text-[#001D4A] uppercase"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Stats Summary */}
              <div className="p-4 bg-gray-900 rounded-2xl text-white flex justify-between items-center">
                <div>
                  <span className="text-[9px] font-black text-orange-400 uppercase tracking-widest block">
                    মোট সক্রিয় আসন (Total Active Seats)
                  </span>
                  <span className="text-xl font-black">{activeSeatsCount} Seats</span>
                </div>
                {layout.disabledSeats.length > 0 && (
                  <span className="text-[10px] font-bold text-gray-400 bg-gray-800 px-2.5 py-1 rounded-lg">
                    {layout.disabledSeats.length} Disabled / Space
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Interactive Visual Layout Preview & Seat Customizer */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white p-6 md:p-8 rounded-[32px] border border-gray-100 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-6 pb-4 border-b border-gray-100">
              <div>
                <h4 className="font-black text-[#001D4A] text-sm uppercase tracking-tight">
                  লাইভ প্রিভিউ ও আসন টগল (Interactive Seat Map)
                </h4>
                <p className="text-gray-400 text-[10px] font-bold mt-0.5">
                  সিটে ক্লিক করে খালি জায়গা/দরজা তৈরি করতে ডিজঅ্যাবল করুন অথবা নাম পরিবর্তন করুন।
                </p>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 shrink-0">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Active</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gray-300"></span> Disabled</span>
              </div>
            </div>

            {/* Visual Bus Container */}
            <div className="max-w-[380px] mx-auto bg-gray-50 border-[10px] border-[#001D4A] rounded-t-[60px] rounded-b-[36px] p-5 pt-20 pb-8 shadow-inner relative">
              {/* Pilot / Wheel */}
              <div className="absolute top-6 right-8 text-[#001D4A]">
                <div className="w-10 h-10 border-2 border-[#001D4A] rounded-xl flex items-center justify-center bg-white shadow-sm">
                  <i className="fas fa-dharmachakra text-base opacity-70"></i>
                </div>
                <span className="text-[7px] uppercase font-black tracking-widest mt-0.5 block text-center opacity-40">Pilot</span>
              </div>

              {/* Rows Rendering */}
              <div className="space-y-3.5">
                {layout.rows.map((row) => {
                  const totalCols = layout.leftColumns + layout.rightColumns;
                  const leftSeats = Array.from({ length: layout.leftColumns }, (_, i) => `${row}${i + 1}`);
                  const rightSeats = Array.from({ length: layout.rightColumns }, (_, i) => `${row}${layout.leftColumns + i + 1}`);

                  return (
                    <div key={row} className="flex justify-between items-center px-1">
                      {/* Left Side */}
                      <div className="flex gap-2">
                        {leftSeats.map(sId => {
                          const isDisabled = layout.disabledSeats.includes(sId);
                          const label = layout.customLabels?.[sId] || sId;
                          return (
                            <button
                              key={sId}
                              type="button"
                              onClick={() => toggleSeatDisabled(sId)}
                              onContextMenu={(e) => { e.preventDefault(); openLabelEdit(sId, label); }}
                              title={`Click to toggle active/disabled. Right-click to rename.`}
                              className={`w-10 h-10 md:w-11 md:h-11 rounded-xl flex flex-col items-center justify-center text-[10px] font-black transition-all ${
                                isDisabled
                                  ? 'bg-gray-200 border border-dashed border-gray-300 text-gray-400 opacity-40 hover:opacity-100'
                                  : 'bg-emerald-500 text-white shadow-md hover:scale-105 active:scale-90'
                              }`}
                            >
                              <span>{isDisabled ? 'X' : label}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Aisle */}
                      <div className="w-6 h-6 rounded-full bg-white border border-gray-200 text-[10px] font-black text-gray-400 flex items-center justify-center">
                        {row}
                      </div>

                      {/* Right Side */}
                      <div className="flex gap-2">
                        {rightSeats.map(sId => {
                          const isDisabled = layout.disabledSeats.includes(sId);
                          const label = layout.customLabels?.[sId] || sId;
                          return (
                            <button
                              key={sId}
                              type="button"
                              onClick={() => toggleSeatDisabled(sId)}
                              onContextMenu={(e) => { e.preventDefault(); openLabelEdit(sId, label); }}
                              title={`Click to toggle active/disabled. Right-click to rename.`}
                              className={`w-10 h-10 md:w-11 md:h-11 rounded-xl flex flex-col items-center justify-center text-[10px] font-black transition-all ${
                                isDisabled
                                  ? 'bg-gray-200 border border-dashed border-gray-300 text-gray-400 opacity-40 hover:opacity-100'
                                  : 'bg-emerald-500 text-white shadow-md hover:scale-105 active:scale-90'
                              }`}
                            >
                              <span>{isDisabled ? 'X' : label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Rear Bench */}
                {layout.hasRearBench && layout.rearBenchSeats > 0 && (
                  <div className="pt-4 mt-2 border-t-2 border-dashed border-gray-200">
                    <div className="flex justify-between gap-1">
                      {Array.from({ length: layout.rearBenchSeats }, (_, i) => `${layout.rearRowLetter}${i + 1}`).map(sId => {
                        const isDisabled = layout.disabledSeats.includes(sId);
                        const label = layout.customLabels?.[sId] || sId;
                        return (
                          <button
                            key={sId}
                            type="button"
                            onClick={() => toggleSeatDisabled(sId)}
                            onContextMenu={(e) => { e.preventDefault(); openLabelEdit(sId, label); }}
                            className={`flex-1 h-10 rounded-xl flex items-center justify-center text-[10px] font-black transition-all ${
                              isDisabled
                                ? 'bg-gray-200 border border-dashed border-gray-300 text-gray-400 opacity-40'
                                : 'bg-emerald-500 text-white shadow-md hover:scale-105'
                            }`}
                          >
                            <span>{isDisabled ? 'X' : label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 p-3 bg-blue-50/70 rounded-2xl border border-blue-100 text-center">
              <p className="text-[10px] font-bold text-blue-700">
                💡 টিপ: কোনো সিটের নাম পরিবর্তন করতে সিটে Right-Click করুন (বা টাচ ধরে রাখুন)।
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Seat Label Rename Dialog */}
      {editingSeatId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-3xl max-w-sm w-full shadow-2xl space-y-4">
            <h4 className="font-black text-[#001D4A] text-base">Rename Seat ({editingSeatId})</h4>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Custom Label</label>
              <input
                type="text"
                autoFocus
                value={customLabelInput}
                onChange={(e) => setCustomLabelInput(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border rounded-xl text-sm font-bold text-[#001D4A] outline-none"
                placeholder={editingSeatId}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingSeatId(null)}
                className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-black text-xs uppercase"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveCustomLabel}
                className="flex-1 py-3 bg-[#001D4A] text-white rounded-xl font-black text-xs uppercase"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BusLayoutEditor;
