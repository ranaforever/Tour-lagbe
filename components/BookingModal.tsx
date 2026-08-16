
import React, { useState, useEffect } from 'react';
import { BookingInfo, Gender, Religion, Tour, CustomerType, Booker, CoPassengerInput } from '../types';

interface BookingModalProps {
  seatIds?: string[];
  seatId?: string; // backwards compatibility
  busNo: string;
  onClose: () => void;
  onSubmit: (infos: BookingInfo[]) => void;
  tours: Tour[];
  bookers: Booker[];
  customerTypes: CustomerType[];
  existingData?: BookingInfo;
  isAdmin?: boolean;
  currentAgentCode?: string;
  notify?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const BookingModal: React.FC<BookingModalProps> = ({ 
  seatIds: propSeatIds, 
  seatId, 
  busNo, 
  onClose, 
  onSubmit, 
  tours, 
  bookers, 
  customerTypes, 
  existingData, 
  isAdmin, 
  currentAgentCode, 
  notify 
}) => {
  // Normalize seat IDs array
  const activeSeatIds: string[] = propSeatIds && propSeatIds.length > 0 
    ? propSeatIds 
    : (seatId ? [seatId] : (existingData ? [existingData.seatNo] : []));

  const primarySeatId = activeSeatIds[0] || 'A1';
  const coSeatIds = activeSeatIds.slice(1);

  // Filter types based on selected tour
  const filteredTypes = customerTypes
    .filter(c => !c.tour_name || c.tour_name === busNo)
    .sort((a, b) => a.fee - b.fee);

  const defaultType = filteredTypes.find(c => c.fee === 0)?.type || (filteredTypes.length > 0 ? filteredTypes[0].type : 'Standard');

  // Primary Passenger State
  const [primaryData, setPrimaryData] = useState({
    name: existingData?.name || '',
    mobile: existingData?.mobile || '',
    address: existingData?.address || '',
    gender: existingData?.gender || Gender.MALE,
    religion: existingData?.religion || Religion.MUSLIM,
    tourName: existingData?.tourName || busNo,
    customerType: existingData?.customerType || defaultType,
    customExtraFee: existingData?.customExtraFee || 0,
    discountAmount: existingData?.discountAmount || 0,
    advanceAmount: existingData?.advanceAmount || 0,
    bookerCode: existingData?.bookerCode || (isAdmin ? 'ADMIN' : (currentAgentCode || ''))
  });

  const [enableCustomExtra, setEnableCustomExtra] = useState(Boolean(existingData?.customExtraFee && existingData.customExtraFee > 0));

  // Co-Passengers State (Default religion: Muslim for every co-passenger!)
  const [coPassengers, setCoPassengers] = useState<Record<string, CoPassengerInput>>(() => {
    const initial: Record<string, CoPassengerInput> = {};
    coSeatIds.forEach(sId => {
      initial[sId] = {
        seatNo: sId,
        name: '',
        gender: Gender.MALE,
        religion: Religion.MUSLIM
      };
    });
    return initial;
  });

  // Update co-passengers when active seats change
  useEffect(() => {
    setCoPassengers(prev => {
      const updated: Record<string, CoPassengerInput> = {};
      coSeatIds.forEach(sId => {
        updated[sId] = prev[sId] || {
          seatNo: sId,
          name: '',
          gender: Gender.MALE,
          religion: Religion.MUSLIM
        };
      });
      return updated;
    });
  }, [activeSeatIds.join(',')]);

  const [addPayment, setAddPayment] = useState(0);
  const [tourPerSeatFee, setTourPerSeatFee] = useState(0);
  const [categoryFee, setCategoryFee] = useState(0);
  const [totalGross, setTotalGross] = useState(0);
  const [dueAmount, setDueAmount] = useState(0);
  const [bookerName, setBookerName] = useState('');

  const currentTour = tours.find(t => t.name === primaryData.tourName);
  const isRelaxTour = currentTour?.tour_type === 'Relax';
  const coupleExtraFee = currentTour?.couple_extra_fee || 0;

  const canEdit = isAdmin || !existingData || existingData.bookerCode.toUpperCase() === currentAgentCode?.toUpperCase();

  useEffect(() => {
    // 1. Tour Base Fee
    const fee = currentTour ? currentTour.fee : 0;
    setTourPerSeatFee(fee);

    // 2. Category Surcharge
    const cType = customerTypes.find(c => c.type === primaryData.customerType);
    let cFee = cType ? cType.fee : 0;

    // If couple category or relax tour couple fee
    if (isRelaxTour && (primaryData.customerType?.toLowerCase().includes('couple') || activeSeatIds.length === 2)) {
      if (coupleExtraFee > 0 && !cType?.fee) {
        cFee = coupleExtraFee;
      }
    }
    setCategoryFee(cFee);

    // 3. Booker resolution
    if (primaryData.bookerCode.toUpperCase() === 'ADMIN' || primaryData.bookerCode.toUpperCase() === 'SYSTEM ADMIN' || isAdmin) {
       setBookerName(primaryData.bookerCode.toUpperCase() === 'ADMIN' ? 'System Admin' : (bookers.find(b => b.code.toUpperCase() === primaryData.bookerCode.toUpperCase())?.name || 'System Admin'));
    } else {
       const booker = bookers.find(b => b.code.toUpperCase() === primaryData.bookerCode.toUpperCase());
       setBookerName(booker ? booker.name : '');
    }

    // 4. Financial Calculations for ALL selected seats
    const extraFee = enableCustomExtra ? (primaryData.customExtraFee || 0) : 0;
    const gross = (fee * activeSeatIds.length) + cFee + extraFee;
    setTotalGross(gross);
    const due = gross - primaryData.discountAmount - primaryData.advanceAmount - addPayment;
    setDueAmount(due);
  }, [primaryData, tours, bookers, customerTypes, addPayment, isAdmin, activeSeatIds.length, currentTour, isRelaxTour, coupleExtraFee, enableCustomExtra]);

  const handlePrimaryChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    if (!canEdit) return;
    let { name, value } = e.target;
    
    if (name === 'mobile') {
      value = value.replace(/\D/g, '');
      if (value.startsWith('0')) {
        value = value.substring(1);
      }
      value = value.substring(0, 10);
    }
    
    setPrimaryData(prev => ({ ...prev, [name]: value }));
  };

  const handleNumericChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEdit) return;
    const { name, value } = e.target;
    setPrimaryData(prev => ({ ...prev, [name]: Number(value) }));
  };

  const handleCoPassengerChange = (seatNo: string, field: keyof CoPassengerInput, value: any) => {
    if (!canEdit) return;
    setCoPassengers(prev => ({
      ...prev,
      [seatNo]: {
        ...prev[seatNo],
        [field]: value
      }
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      notify?.("Unauthorized: You cannot edit this booking.", 'error');
      return;
    }
    if (!isAdmin && !bookerName) {
      notify?.("Invalid Agent Code. Please check agent authorization.", 'error');
      return;
    }

    if (!primaryData.name.trim()) {
      notify?.("Please provide the primary passenger's name.", 'error');
      return;
    }

    const totalSeatsCount = activeSeatIds.length;
    const commonGroupId = `GRP-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    const primaryId = existingData?.id || `BKG-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    const bookingDate = existingData?.bookingDate || new Date().toISOString();

    const bookingsToSubmit: BookingInfo[] = [];

    // 1. Primary Booking Record
    const extraFeeAmount = enableCustomExtra ? (primaryData.customExtraFee || 0) : 0;
    const primaryBooking: BookingInfo = {
      id: primaryId,
      name: primaryData.name.trim(),
      mobile: primaryData.mobile,
      address: primaryData.address,
      gender: primaryData.gender,
      religion: primaryData.religion,
      tourName: primaryData.tourName,
      tourFees: tourPerSeatFee,
      customerType: primaryData.customerType,
      customerTypeFees: categoryFee + extraFeeAmount,
      customExtraFee: extraFeeAmount,
      discountAmount: primaryData.discountAmount,
      advanceAmount: primaryData.advanceAmount + addPayment,
      dueAmount: dueAmount,
      paymentStatus: dueAmount <= 0 ? 'Paid' : ((primaryData.advanceAmount + addPayment) > 0 ? 'Partial' : 'Due'),
      busNo: primaryData.tourName,
      seatNo: primarySeatId,
      bookedBy: bookerName || 'System Admin',
      bookerCode: primaryData.bookerCode,
      bookingDate: bookingDate,
      isPrimary: true,
      primaryBookingId: primaryId,
      totalGroupSeats: totalSeatsCount,
      groupSeatsList: activeSeatIds
    };
    bookingsToSubmit.push(primaryBooking);

    // 2. Co-Passengers Records (for the other selected seats)
    coSeatIds.forEach((sId) => {
      const co = coPassengers[sId] || {
        seatNo: sId,
        name: '',
        gender: Gender.MALE,
        religion: Religion.MUSLIM
      };

      const coName = co.name?.trim() ? co.name.trim() : `${primaryData.name.trim()} (সহ-যাত্রী ${sId})`;
      const coId = `BKG-${Date.now()}-${sId}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

      const coBooking: BookingInfo = {
        id: coId,
        name: coName,
        mobile: primaryData.mobile,
        address: primaryData.address,
        gender: co.gender || Gender.MALE,
        religion: co.religion || Religion.MUSLIM,
        tourName: primaryData.tourName,
        tourFees: tourPerSeatFee,
        customerType: primaryData.customerType,
        customerTypeFees: 0, // billed on primary
        discountAmount: 0,
        advanceAmount: 0,
        dueAmount: 0, // combined due is tracked on primary
        paymentStatus: primaryBooking.paymentStatus,
        busNo: primaryData.tourName,
        seatNo: sId,
        bookedBy: bookerName || 'System Admin',
        bookerCode: primaryData.bookerCode,
        bookingDate: bookingDate,
        isPrimary: false,
        primaryBookingId: primaryId,
        totalGroupSeats: totalSeatsCount,
        groupSeatsList: activeSeatIds
      };
      bookingsToSubmit.push(coBooking);
    });

    onSubmit(bookingsToSubmit);
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-end md:items-center justify-center p-0 md:p-4 bg-[#001D4A]/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-t-[40px] md:rounded-[40px] shadow-2xl animate-in slide-in-from-bottom duration-300 border border-white/20 flex flex-col max-h-[94vh] md:max-h-[95vh] overflow-hidden">
        {/* Modal Header */}
        <div className="bg-[#001D4A] p-6 md:p-8 text-white flex justify-between items-center relative shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-orange-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider">
                {activeSeatIds.length} Seats
              </span>
              {isRelaxTour && (
                <span className="px-2.5 py-1 bg-emerald-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                  <i className="fas fa-umbrella-beach"></i> Relax Tour
                </span>
              )}
            </div>
            <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight mt-1">
              {existingData ? 'Modify Booking' : 'বুকিং নিশ্চিত করুন (Confirm Booking)'}
            </h3>
            <p className="text-orange-300 text-xs font-bold tracking-wide mt-0.5">
              নির্বাচিত আসন: <span className="text-white font-black">{activeSeatIds.join(', ')}</span> | {primaryData.tourName}
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="w-11 h-11 rounded-2xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all"
          >
            <i className="fas fa-times text-lg"></i>
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="p-5 md:p-8 overflow-y-auto custom-scrollbar space-y-7">
          <div className="space-y-6">
            {/* 1. PRIMARY PASSENGER SECTION */}
            <div className="bg-orange-50/50 border-2 border-orange-100 p-5 md:p-6 rounded-[28px] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-xl bg-orange-500 text-white font-black text-xs flex items-center justify-center shadow-md">
                    1
                  </span>
                  <div>
                    <h4 className="font-black text-[#001D4A] text-sm uppercase tracking-tight">
                      প্রধান বুকিংকারী (Primary Lead Passenger)
                    </h4>
                    <p className="text-[10px] text-gray-500 font-bold">আসন: {primarySeatId}</p>
                  </div>
                </div>
                <span className="text-[9px] font-black text-orange-600 bg-orange-100/80 px-2.5 py-1 rounded-full uppercase">
                  Lead Booker
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">
                    যাত্রীর পুরো নাম (Full Name) *
                  </label>
                  <input 
                    required 
                    name="name" 
                    value={primaryData.name} 
                    onChange={handlePrimaryChange} 
                    className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-2xl text-sm font-bold text-[#001D4A] focus:ring-2 focus:ring-orange-400 outline-none shadow-sm" 
                    placeholder="প্রধান বুকিংকারীর নাম লিখুন" 
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">
                    মোবাইল নাম্বার (Mobile Number) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-black text-xs">+880</span>
                    <input 
                      required 
                      name="mobile" 
                      inputMode="tel" 
                      value={primaryData.mobile} 
                      onChange={handlePrimaryChange} 
                      className="w-full pl-16 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl text-sm font-bold text-[#001D4A] focus:ring-2 focus:ring-orange-400 outline-none shadow-sm" 
                      placeholder="1XXXXXXXXX" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">
                      জেন্ডার (Gender) *
                    </label>
                    <select 
                      name="gender" 
                      value={primaryData.gender} 
                      onChange={handlePrimaryChange} 
                      className="w-full px-3.5 py-3.5 bg-white border border-gray-200 rounded-2xl text-xs font-black text-[#001D4A] uppercase outline-none shadow-sm focus:ring-2 focus:ring-orange-400"
                    >
                      {Object.values(Gender).map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">
                      ধর্ম (Religion) *
                    </label>
                    <select 
                      name="religion" 
                      value={primaryData.religion} 
                      onChange={handlePrimaryChange} 
                      className="w-full px-3.5 py-3.5 bg-white border border-gray-200 rounded-2xl text-xs font-black text-[#001D4A] uppercase outline-none shadow-sm focus:ring-2 focus:ring-orange-400"
                    >
                      {Object.values(Religion).map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">
                    ঠিকানা / পিকআপ পয়েন্ট (Address/Pickup)
                  </label>
                  <input 
                    name="address" 
                    value={primaryData.address} 
                    onChange={handlePrimaryChange} 
                    className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-2xl text-xs font-bold text-[#001D4A] focus:ring-2 focus:ring-orange-400 outline-none shadow-sm" 
                    placeholder="বোর্ড বাজার / ঢাকা / ইত্যাদি" 
                  />
                </div>
              </div>
            </div>

            {/* 2. CO-PASSENGERS SECTION (If more than 1 seat is selected) */}
            {coSeatIds.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-[#001D4A] text-xs uppercase tracking-wider flex items-center gap-2">
                    <i className="fas fa-user-friends text-indigo-500"></i>
                    সহ-যাত্রীদের বিবরণ (Co-Passengers - {coSeatIds.length} জন)
                  </h4>
                  <span className="text-[9px] text-gray-500 font-bold bg-gray-100 px-2.5 py-1 rounded-full">
                    নাম ঐচ্ছিক, জেন্ডার ও ধর্ম আবশ্যক (Default: Muslim)
                  </span>
                </div>

                <div className="space-y-3">
                  {coSeatIds.map((sId, index) => {
                    const co = coPassengers[sId] || {
                      seatNo: sId,
                      name: '',
                      gender: Gender.MALE,
                      religion: Religion.MUSLIM
                    };

                    return (
                      <div 
                        key={sId} 
                        className="bg-indigo-50/40 border border-indigo-100 p-4 md:p-5 rounded-2xl space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-black text-[10px] flex items-center justify-center">
                              {index + 2}
                            </span>
                            <span className="font-black text-[#001D4A] text-xs uppercase">
                              আসন {sId} (Co-Passenger #{index + 1})
                            </span>
                          </div>
                          <span className="text-[9px] font-bold text-indigo-600 bg-white px-2 py-0.5 rounded-md border border-indigo-100">
                            Seat {sId}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {/* Name: Optional as per user prompt */}
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
                              নাম (Name - ঐচ্ছিক)
                            </label>
                            <input 
                              type="text"
                              value={co.name || ''} 
                              onChange={(e) => handleCoPassengerChange(sId, 'name', e.target.value)}
                              placeholder={`নাম (ঐচ্ছিক / ${primaryData.name || 'গেস্ট'})`}
                              className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#001D4A] focus:ring-2 focus:ring-indigo-400 outline-none"
                            />
                          </div>

                          {/* Gender: Mandatory */}
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
                              জেন্ডার (Gender) *
                            </label>
                            <select 
                              value={co.gender} 
                              onChange={(e) => handleCoPassengerChange(sId, 'gender', e.target.value as Gender)}
                              className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-black text-[#001D4A] uppercase outline-none focus:ring-2 focus:ring-indigo-400"
                            >
                              {Object.values(Gender).map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                          </div>

                          {/* Religion: Mandatory with Muslim default */}
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
                              ধর্ম (Religion) *
                            </label>
                            <select 
                              value={co.religion} 
                              onChange={(e) => handleCoPassengerChange(sId, 'religion', e.target.value as Religion)}
                              className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-black text-[#001D4A] uppercase outline-none focus:ring-2 focus:ring-indigo-400"
                            >
                              {Object.values(Religion).map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. TOUR BILLING & PAYMENT SECTION */}
            <div className="bg-gray-50 p-5 md:p-6 rounded-[28px] border border-gray-200 space-y-4">
              <h4 className="font-black text-[#001D4A] text-xs uppercase tracking-wider flex items-center gap-2">
                <i className="fas fa-receipt text-emerald-600"></i>
                বিল ও পেমেন্ট হিসাব (Billing & Payments)
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Active Tour / Category */}
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Selected Tour</label>
                    <div className="p-3.5 bg-white rounded-2xl border border-gray-200 flex items-center justify-between">
                      <div>
                        <span className="font-black text-[#001D4A] text-xs block">{primaryData.tourName}</span>
                        <span className="text-[10px] text-gray-500 font-bold">
                          প্রতি সিট ৳{(tourPerSeatFee || 0).toLocaleString()} × {activeSeatIds.length} = ৳{((tourPerSeatFee || 0) * activeSeatIds.length).toLocaleString()}
                        </span>
                      </div>
                      <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg uppercase ${isRelaxTour ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                        {currentTour?.tour_type || 'Day Long'}
                      </span>
                    </div>
                  </div>

                  {/* Pricing Category & Couple surcharge */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Pricing Category / রুম সুবিধা</label>
                    <select 
                      name="customerType" 
                      value={primaryData.customerType} 
                      onChange={handlePrimaryChange} 
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl font-black text-[#001D4A] text-xs uppercase outline-none"
                    >
                      {filteredTypes.map(c => (
                        <option key={c.type} value={c.type}>
                          {c.type} {(c.fee || 0) > 0 ? `(+৳${(c.fee || 0).toLocaleString()})` : '(স্ট্যান্ডার্ড ফি)'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Custom Extra Fee Option (কাস্টম অতিরিক্ত ফি) */}
                  <div className="space-y-2 pt-0.5">
                    <div 
                      onClick={() => {
                        const nextState = !enableCustomExtra;
                        setEnableCustomExtra(nextState);
                        if (!nextState) {
                          setPrimaryData(prev => ({ ...prev, customExtraFee: 0 }));
                        }
                      }}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${enableCustomExtra ? 'bg-indigo-50/90 border-indigo-300 ring-2 ring-indigo-200/50' : 'bg-white border-gray-200 hover:border-gray-300'}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-all ${enableCustomExtra ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300 bg-gray-50 text-transparent'}`}>
                          <i className="fas fa-check text-[10px]"></i>
                        </div>
                        <div>
                          <span className="text-xs font-black text-[#001D4A] block">
                            Custom Extra (কাস্টম অতিরিক্ত ফি)
                          </span>
                          <span className="text-[9px] text-gray-400 font-bold block leading-tight">
                            বিশেষ সুবিধা / অতিরিক্ত চার্জ যুক্ত করুন
                          </span>
                        </div>
                      </div>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase ${enableCustomExtra ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-100 text-gray-400'}`}>
                        {enableCustomExtra ? 'Enabled' : '+ Add'}
                      </span>
                    </div>

                    {enableCustomExtra && (
                      <div className="p-3.5 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-2xl border border-indigo-200 animate-in fade-in zoom-in-95 duration-200 space-y-1.5 shadow-sm">
                        <div className="flex justify-between items-center">
                          <label className="text-[9px] font-black text-indigo-900 uppercase tracking-widest flex items-center gap-1">
                            <i className="fas fa-plus-circle text-indigo-600"></i>
                            অতিরিক্ত ফি ইনপুট (Extra Amount ৳)
                          </label>
                          <span className="text-[8.5px] font-extrabold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">মোট টাকায় যোগ হবে</span>
                        </div>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-indigo-800 text-base">৳</span>
                          <input 
                            type="number" 
                            inputMode="numeric"
                            name="customExtraFee"
                            value={primaryData.customExtraFee || ''}
                            onChange={handleNumericChange}
                            placeholder="যেমন: ৫০০"
                            className="w-full pl-8 pr-4 py-2.5 bg-white border border-indigo-300 rounded-xl font-black text-base text-indigo-950 outline-none focus:ring-2 focus:ring-indigo-400 shadow-inner"
                            autoFocus
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {isRelaxTour && coupleExtraFee > 0 && (
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between text-xs text-emerald-800 font-bold">
                      <span><i className="fas fa-hotel mr-1 text-emerald-600"></i> কাপল রুম অতিরিক্ত ফি:</span>
                      <span className="font-black">৳{(coupleExtraFee || 0).toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {/* Discounts & Advances */}
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Discount (ছাড় ৳)</label>
                      <input 
                        type="number" 
                        inputMode="numeric" 
                        name="discountAmount" 
                        value={primaryData.discountAmount || ''} 
                        onChange={handleNumericChange} 
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl font-black text-sm text-[#001D4A] outline-none" 
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-emerald-600 uppercase tracking-widest ml-1">Advance (অগ্রিম ৳)</label>
                      <input 
                        type="number" 
                        inputMode="numeric" 
                        name="advanceAmount" 
                        value={primaryData.advanceAmount || ''} 
                        onChange={handleNumericChange} 
                        className="w-full px-4 py-3 bg-white border border-emerald-300 rounded-2xl font-black text-sm text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-400" 
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {/* Quick Payment Preset Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        const netPayable = Math.max(0, totalGross - (primaryData.discountAmount || 0));
                        setPrimaryData(prev => ({ ...prev, advanceAmount: netPayable }));
                      }}
                      className="px-2.5 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1"
                    >
                      <i className="fas fa-check-circle text-[9px]"></i> Paid Full (সম্পূর্ণ পেইড)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const netPayable = Math.max(0, totalGross - (primaryData.discountAmount || 0));
                        setPrimaryData(prev => ({ ...prev, advanceAmount: Math.round(netPayable / 2) }));
                      }}
                      className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-[10px] font-black uppercase transition-all"
                    >
                      50% Advance
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPrimaryData(prev => ({ ...prev, advanceAmount: 0 }));
                      }}
                      className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-[10px] font-black uppercase transition-all"
                    >
                      Full Due (সম্পূর্ণ বাকি)
                    </button>
                  </div>

                  {/* Payment Status & Net Due Summary Box */}
                  <div className="p-4 bg-[#001D4A] rounded-2xl text-white shadow-lg space-y-2">
                    <div className="flex justify-between items-center pb-2 border-b border-white/10">
                      <div>
                        <span className="text-[8px] font-black text-emerald-400 uppercase tracking-wider block">
                          Total Advance Paid (পরিশোধিত)
                        </span>
                        <span className="text-base font-black text-emerald-400">
                          ৳{(primaryData.advanceAmount || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[8px] font-black text-orange-400 uppercase tracking-wider block">
                          Net Due (বকেয়া)
                        </span>
                        <span className="text-xl font-black text-amber-300">
                          ৳{(dueAmount || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center text-[10px] text-gray-300 font-bold pt-0.5">
                      <span>মোট গ্রস বিল: ৳{(totalGross || 0).toLocaleString()}</span>
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${dueAmount <= 0 ? 'bg-emerald-500 text-white' : (primaryData.advanceAmount > 0 ? 'bg-amber-500 text-white' : 'bg-rose-500 text-white')}`}>
                        {dueAmount <= 0 ? 'Paid' : (primaryData.advanceAmount > 0 ? 'Partial' : 'Unpaid')}
                      </span>
                    </div>
                  </div>

                  {/* Agent Code */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Booker Agent Code</label>
                    <div className="relative">
                      <input 
                        required 
                        name="bookerCode" 
                        value={primaryData.bookerCode} 
                        onChange={handlePrimaryChange} 
                        className={`w-full px-4 py-2.5 border-2 rounded-2xl font-black text-xs tracking-widest uppercase outline-none transition-all ${isAdmin ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : (bookerName ? 'border-green-400 bg-green-50 text-green-700' : 'border-gray-200 bg-white text-gray-800')}`} 
                        placeholder={isAdmin ? "ADMIN" : "AGENT CODE"} 
                      />
                      {bookerName && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-green-600 flex items-center gap-1">
                          <i className="fas fa-check-circle"></i> {bookerName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Form Submit Footer */}
          <div className="pt-3 sticky bottom-0 bg-white pb-2">
            {canEdit ? (
               <button 
                type="submit" 
                className="w-full py-4.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-2xl font-black text-base md:text-lg shadow-xl shadow-orange-500/20 active:scale-98 transition-all uppercase tracking-widest flex items-center justify-center gap-2"
               >
                 <i className="fas fa-check-circle"></i>
                 <span>
                   {activeSeatIds.length > 1 ? `${activeSeatIds.length} টি আসন একসাথে বুকিং করুন` : 'বুকিং নিশ্চিত করুন (Confirm Booking)'}
                 </span>
               </button>
            ) : (
               <div className="w-full py-4 bg-gray-100 text-gray-400 rounded-2xl font-black text-center text-xs uppercase tracking-widest border border-dashed border-gray-200">
                 View Only Mode
               </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default BookingModal;

