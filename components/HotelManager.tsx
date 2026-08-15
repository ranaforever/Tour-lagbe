import React, { useState, useMemo } from 'react';
import { Hotel, HotelRoom, RoomType, BookingInfo, Tour, Gender } from '../types';
import { DEFAULT_HOTELS, DEFAULT_ROOMS } from '../constants';

interface HotelManagerProps {
  hotels: Hotel[];
  rooms: HotelRoom[];
  tours: Tour[];
  allBookings: BookingInfo[];
  isAdmin?: boolean;
  onAddHotel?: (hotel: Hotel) => void;
  onUpdateHotel?: (hotel: Hotel) => void;
  onDeleteHotel?: (hotelId: string) => void;
  onAddRoom?: (room: HotelRoom) => void;
  onUpdateRoom?: (room: HotelRoom) => void;
  onDeleteRoom?: (roomId: string) => void;
  onAssignPassenger: (roomId: string, bookingId: string) => void;
  onUnassignPassenger: (roomId: string, bookingId: string) => void;
  onBulkAssign?: (roomId: string, bookingIds: string[]) => void;
  notify?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const ROOM_TYPE_CAPACITIES: Record<RoomType, { label: string; capacity: number; color: string; badge: string }> = {
  Single: { label: 'Single Room (১ জন)', capacity: 1, color: 'border-blue-200 bg-blue-50/50', badge: 'bg-blue-100 text-blue-800' },
  Couple: { label: 'Couple Room (২ জন)', capacity: 2, color: 'border-pink-200 bg-pink-50/50', badge: 'bg-pink-100 text-pink-800' },
  Combine4: { label: 'Combine Room (৪ জন)', capacity: 4, color: 'border-indigo-200 bg-indigo-50/50', badge: 'bg-indigo-100 text-indigo-800' },
  Combine5: { label: 'Combine Room (৫ জন)', capacity: 5, color: 'border-purple-200 bg-purple-50/50', badge: 'bg-purple-100 text-purple-800' },
  Combine6: { label: 'Combine Room (৬ জন)', capacity: 6, color: 'border-teal-200 bg-teal-50/50', badge: 'bg-teal-100 text-teal-800' },
  Custom: { label: 'Custom Capacity', capacity: 3, color: 'border-gray-200 bg-gray-50/50', badge: 'bg-gray-100 text-gray-800' }
};

const HotelManager: React.FC<HotelManagerProps> = ({
  hotels = DEFAULT_HOTELS,
  rooms = DEFAULT_ROOMS,
  tours,
  allBookings,
  isAdmin = false,
  onAddHotel,
  onUpdateHotel,
  onDeleteHotel,
  onAddRoom,
  onUpdateRoom,
  onDeleteRoom,
  onAssignPassenger,
  onUnassignPassenger,
  notify
}) => {
  const [selectedTourName, setSelectedTourName] = useState<string>(tours[0]?.name || '');
  const [activeSubTab, setActiveSubTab] = useState<'allocation' | 'hotels' | 'print'>('allocation');

  // Form & Edit Modals states
  const [showAddHotelModal, setShowAddHotelModal] = useState(false);
  const [editingHotel, setEditingHotel] = useState<Hotel | null>(null);

  const [showAddRoomModal, setShowAddRoomModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState<HotelRoom | null>(null);
  const [selectedHotelForRoom, setSelectedHotelForRoom] = useState<string>('');

  const [newHotel, setNewHotel] = useState<Partial<Hotel>>({
    name: '',
    location: '',
    tourName: selectedTourName,
    contactNumber: '',
    address: ''
  });

  const [newRoom, setNewRoom] = useState<{
    roomNo: string;
    roomType: RoomType;
    capacity: number;
    floor: string;
    hotelId: string;
  }>({
    roomNo: '',
    roomType: 'Couple',
    capacity: 2,
    floor: '1st Floor',
    hotelId: ''
  });

  // Filter bookings for current tour
  const tourBookings = useMemo(() => {
    return allBookings.filter(b => b.busNo === selectedTourName || b.tourName === selectedTourName);
  }, [allBookings, selectedTourName]);

  // Filter rooms for current tour
  const tourRooms = useMemo(() => {
    return rooms.filter(r => r.tourName === selectedTourName);
  }, [rooms, selectedTourName]);

  // Filter hotels for current tour
  const tourHotels = useMemo(() => {
    return hotels.filter(h => !h.tourName || h.tourName === selectedTourName);
  }, [hotels, selectedTourName]);

  // Find all passenger IDs already assigned to ANY room in this tour
  const assignedBookingIds = useMemo(() => {
    const ids = new Set<string>();
    tourRooms.forEach(r => {
      (r.assignedBookingIds || []).forEach(id => ids.add(id));
    });
    return ids;
  }, [tourRooms]);

  // Unassigned passengers
  const unassignedBookings = useMemo(() => {
    return tourBookings.filter(b => !assignedBookingIds.has(b.id));
  }, [tourBookings, assignedBookingIds]);

  const handleRoomTypeSelect = (type: RoomType, isEdit = false) => {
    const config = ROOM_TYPE_CAPACITIES[type];
    if (isEdit && editingRoom) {
      setEditingRoom(prev => prev ? ({
        ...prev,
        roomType: type,
        capacity: config ? config.capacity : prev.capacity
      }) : null);
    } else {
      setNewRoom(prev => ({
        ...prev,
        roomType: type,
        capacity: config ? config.capacity : prev.capacity
      }));
    }
  };

  const handleCreateHotel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      notify?.("Only Admin can add hotels.", 'error');
      return;
    }
    if (!newHotel.name?.trim()) return;

    const created: Hotel = {
      id: `htl-${Date.now()}`,
      name: newHotel.name.trim(),
      location: newHotel.location || selectedTourName,
      tourName: selectedTourName,
      contactNumber: newHotel.contactNumber || '',
      address: newHotel.address || ''
    };

    onAddHotel?.(created);
    setShowAddHotelModal(false);
    setNewHotel({ name: '', location: '', tourName: selectedTourName, contactNumber: '', address: '' });
    notify?.(`Hotel "${created.name}" added successfully!`, 'success');
  };

  const handleSaveHotelEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !editingHotel) return;
    if (!editingHotel.name.trim()) return;

    onUpdateHotel?.(editingHotel);
    setEditingHotel(null);
    notify?.(`Hotel "${editingHotel.name}" updated!`, 'success');
  };

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      notify?.("Only Admin can create rooms.", 'error');
      return;
    }
    if (!newRoom.roomNo.trim()) return;

    const targetHotel = hotels.find(h => h.id === (newRoom.hotelId || selectedHotelForRoom)) || tourHotels[0];
    if (!targetHotel) {
      notify?.("Please select or add a hotel first.", 'error');
      return;
    }

    const created: HotelRoom = {
      id: `rm-${Date.now()}`,
      hotelId: targetHotel.id,
      hotelName: targetHotel.name,
      tourName: selectedTourName,
      roomNo: newRoom.roomNo.trim(),
      roomType: newRoom.roomType,
      capacity: Number(newRoom.capacity) || 2,
      floor: newRoom.floor || '1st Floor',
      assignedBookingIds: []
    };

    onAddRoom?.(created);
    setShowAddRoomModal(false);
    setNewRoom({ roomNo: '', roomType: 'Couple', capacity: 2, floor: '1st Floor', hotelId: targetHotel.id });
    notify?.(`Room ${created.roomNo} (${created.roomType}) added!`, 'success');
  };

  const handleSaveRoomEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !editingRoom) return;
    if (!editingRoom.roomNo.trim()) return;

    onUpdateRoom?.(editingRoom);
    setEditingRoom(null);
    notify?.(`Room ${editingRoom.roomNo} updated!`, 'success');
  };

  const handlePrintAllocationSheet = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header Card with Tour Selector & Actions */}
      <div className="bg-white p-6 md:p-8 rounded-[32px] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full flex items-center gap-1">
              <i className="fas fa-hotel"></i> Hotel & Room Management
            </span>
            {isAdmin ? (
              <span className="text-[9px] font-black text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full uppercase flex items-center gap-1">
                <i className="fas fa-shield-alt"></i> Admin Privileges (Full Access)
              </span>
            ) : (
              <span className="text-[9px] font-black text-orange-700 bg-orange-50 px-2.5 py-0.5 rounded-full uppercase flex items-center gap-1">
                <i className="fas fa-user-tag"></i> Agent Access (Allocation Only)
              </span>
            )}
          </div>
          <h3 className="text-2xl font-black text-[#001D4A] mt-2">
            হোটেল ও রুম ম্যানেজমেন্ট (Room Allocation)
          </h3>
          <p className="text-gray-400 text-xs font-bold mt-0.5">
            {isAdmin 
              ? 'ট্যুরের জন্য হোটেল ও রুম তৈরি, এডিট, ডিলিট এবং যাত্রী বরাদ্দ করুন।'
              : 'যাত্রীদের কাপল, সিঙ্গেল বা কম্বাইন রুমে বরাদ্দ (Allocate) করুন ও তালিকা প্রিন্ট করুন।'}
          </p>
        </div>

        {/* Tour Filter & Print Buttons */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select
            value={selectedTourName}
            onChange={(e) => setSelectedTourName(e.target.value)}
            className="px-4 py-3.5 bg-indigo-50 border-none rounded-2xl font-black text-indigo-700 text-xs uppercase outline-none shadow-sm cursor-pointer"
          >
            {tours.map(t => (
              <option key={t.name} value={t.name}>
                {t.name} ({t.tour_type || 'Day Long'})
              </option>
            ))}
          </select>

          <button
            onClick={() => setActiveSubTab('print')}
            className="px-5 py-3.5 bg-[#001D4A] text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-md hover:bg-opacity-90 active:scale-95 transition-all flex items-center gap-2"
          >
            <i className="fas fa-print"></i>
            <span>রুম চার্ট প্রিন্ট (Print)</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveSubTab('allocation')}
          className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
            activeSubTab === 'allocation'
              ? 'bg-[#001D4A] text-white shadow-md'
              : 'bg-white text-gray-500 hover:bg-gray-100'
          }`}
        >
          <i className="fas fa-bed"></i>
          <span>রুম অ্যালটমেন্ট (Room Allocation Board)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('hotels')}
          className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
            activeSubTab === 'hotels'
              ? 'bg-[#001D4A] text-white shadow-md'
              : 'bg-white text-gray-500 hover:bg-gray-100'
          }`}
        >
          <i className="fas fa-building"></i>
          <span>হোটেল ও রুম তালিকা (Hotels & Rooms)</span>
        </button>
      </div>

      {/* VIEW 1: ROOM ALLOCATION BOARD */}
      {activeSubTab === 'allocation' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Unassigned Passengers (রুম বরাদ্দহীন যাত্রী) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white p-5 rounded-[28px] border border-gray-100 shadow-sm space-y-4 sticky top-6">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div>
                  <h4 className="font-black text-[#001D4A] text-xs uppercase tracking-tight flex items-center gap-2">
                    <i className="fas fa-users text-orange-500"></i>
                    বরাদ্দহীন যাত্রী (Unassigned)
                  </h4>
                  <p className="text-[10px] text-gray-400 font-bold mt-0.5">
                    মোট: {unassignedBookings.length} জন যাত্রী বাকি
                  </p>
                </div>
                <span className="w-7 h-7 rounded-xl bg-orange-100 text-orange-700 font-black text-xs flex items-center justify-center">
                  {unassignedBookings.length}
                </span>
              </div>

              {/* Unassigned List */}
              <div className="space-y-2.5 max-h-[600px] overflow-y-auto custom-scrollbar pr-1">
                {unassignedBookings.length === 0 ? (
                  <div className="py-12 text-center bg-emerald-50/50 rounded-2xl border border-dashed border-emerald-200">
                    <i className="fas fa-check-circle text-emerald-500 text-3xl mb-2"></i>
                    <p className="text-emerald-700 font-black text-xs uppercase">সব যাত্রীকে রুম দেওয়া হয়েছে!</p>
                    <p className="text-[10px] text-emerald-600 font-medium mt-0.5">All passengers allocated.</p>
                  </div>
                ) : (
                  unassignedBookings.map(b => (
                    <div
                      key={b.id}
                      className="p-3.5 bg-gray-50 hover:bg-orange-50/50 rounded-2xl border border-gray-200/80 transition-all space-y-2 group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[8px] font-black text-white bg-[#001D4A] px-1.5 py-0.5 rounded uppercase">
                              Seat {b.seatNo}
                            </span>
                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${
                              b.gender === Gender.FEMALE ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {b.gender}
                            </span>
                            <span className="text-[8px] font-bold text-gray-500 bg-gray-200 px-1 py-0.5 rounded">
                              {b.religion}
                            </span>
                          </div>
                          <p className="font-black text-xs text-[#001D4A] truncate">{b.name}</p>
                          <p className="text-[9px] font-bold text-gray-400 mt-0.5">+880{b.mobile}</p>
                        </div>
                      </div>

                      {/* Quick Assign Dropdown for this passenger */}
                      <div className="pt-2 border-t border-gray-200/60 flex items-center gap-2">
                        <select
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) {
                              onAssignPassenger(e.target.value, b.id);
                              e.target.value = "";
                            }
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-xl text-[10px] font-black text-indigo-700 outline-none cursor-pointer"
                        >
                          <option value="" disabled>রুম নির্বাচন করুন (Select Room)...</option>
                          {tourRooms.map(r => {
                            const occCount = (r.assignedBookingIds || []).length;
                            const isFull = occCount >= r.capacity;
                            return (
                              <option key={r.id} value={r.id} disabled={isFull}>
                                Room {r.roomNo} - {r.roomType} ({occCount}/{r.capacity}) {isFull ? '[FULL]' : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Hotel Rooms Grid (রুম সমূহ ও তাদের যাত্রী) */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-black text-[#001D4A] text-sm uppercase tracking-tight">
                  হোটেল রুম তালিকা ও বরাদ্দ অবস্থা (Hotel Rooms - {tourRooms.length} Rooms)
                </h4>
                <p className="text-gray-400 text-xs font-bold">
                  {selectedTourName} • মোট ক্যাপাসিটি: {tourRooms.reduce((acc, r) => acc + r.capacity, 0)} সিট
                </p>
              </div>

              {isAdmin && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAddRoomModal(true)}
                    className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-black text-xs uppercase shadow-md flex items-center gap-1.5 active:scale-95 transition-all"
                  >
                    <i className="fas fa-plus"></i>
                    <span>রুম যোগ করুন (+ Room)</span>
                  </button>
                </div>
              )}
            </div>

            {/* Room Cards Grid */}
            {tourRooms.length === 0 ? (
              <div className="py-20 text-center bg-white rounded-[32px] border-2 border-dashed border-gray-200 p-8">
                <i className="fas fa-hotel text-4xl text-gray-300 mb-3"></i>
                <h5 className="font-black text-gray-600 text-base">কোনো রুম যুক্ত করা হয়নি</h5>
                <p className="text-gray-400 text-xs font-medium mt-1 mb-4">
                  {isAdmin 
                    ? 'এই ট্যুরের জন্য হোটেল ও রুম তৈরি করতে নিচের বাটনে ক্লিক করুন।'
                    : 'এই ট্যুরের জন্য এখনো কোনো রুম তৈরি করা হয়নি। অ্যাডমিনের সাথে যোগাযোগ করুন।'}
                </p>
                {isAdmin && (
                  <button
                    onClick={() => setShowAddRoomModal(true)}
                    className="px-5 py-3 bg-[#001D4A] text-white rounded-xl font-black text-xs uppercase"
                  >
                    + Add First Room
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tourRooms.map(room => {
                  const occupants = tourBookings.filter(b => (room.assignedBookingIds || []).includes(b.id));
                  const occCount = occupants.length;
                  const isFull = occCount >= room.capacity;
                  const isOver = occCount > room.capacity;
                  const config = ROOM_TYPE_CAPACITIES[room.roomType] || ROOM_TYPE_CAPACITIES.Couple;

                  return (
                    <div
                      key={room.id}
                      className={`p-5 bg-white rounded-[28px] border-2 shadow-sm flex flex-col justify-between transition-all ${
                        isOver
                          ? 'border-red-400 bg-red-50/20'
                          : isFull
                          ? 'border-emerald-300 bg-emerald-50/20'
                          : 'border-gray-200 hover:border-indigo-300'
                      }`}
                    >
                      <div>
                        {/* Room Header */}
                        <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-base font-black text-[#001D4A]">
                                Room {room.roomNo}
                              </span>
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase ${config.badge}`}>
                                {config.label}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-400 font-bold mt-0.5">
                              {room.hotelName || 'Hotel'} • {room.floor || 'Floor'}
                            </p>
                          </div>

                          {/* Capacity Badge */}
                          <div className="text-right">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                              isFull ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700'
                            }`}>
                              {occCount} / {room.capacity} জন
                            </span>
                          </div>
                        </div>

                        {/* Occupants List in this room */}
                        <div className="space-y-2 mb-4 min-h-[70px]">
                          {occupants.length === 0 ? (
                            <div className="py-5 text-center text-gray-400 text-xs font-bold border border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                              <i className="fas fa-bed text-gray-300 mb-1 block"></i>
                              রুম খালি রয়েছে (Vacant Room)
                            </div>
                          ) : (
                            occupants.map(occ => (
                              <div
                                key={occ.id}
                                className="flex items-center justify-between p-2.5 bg-gray-50 hover:bg-white rounded-xl border border-gray-200 transition-all text-xs"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="w-6 h-6 rounded-lg bg-[#001D4A] text-white font-black text-[9px] flex items-center justify-center shrink-0">
                                    {occ.seatNo}
                                  </span>
                                  <div className="truncate">
                                    <span className="font-black text-[#001D4A] block truncate">{occ.name}</span>
                                    <span className="text-[8px] text-gray-400 font-bold">{occ.gender} • {occ.religion}</span>
                                  </div>
                                </div>

                                <button
                                  onClick={() => onUnassignPassenger(room.id, occ.id)}
                                  className="w-7 h-7 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition-all shrink-0 ml-1"
                                  title="রুম থেকে সরান (Remove from room)"
                                >
                                  <i className="fas fa-times text-xs"></i>
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Room Action Buttons */}
                      <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                        <span className="text-[9px] font-bold text-gray-400">
                          {room.capacity - occCount > 0 ? `${room.capacity - occCount} সিট খালি` : 'রুম ভর্তি (Full)'}
                        </span>

                        {isAdmin && (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => setEditingRoom(room)}
                              className="px-2.5 py-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-[10px] font-black"
                              title="Edit Room"
                            >
                              <i className="fas fa-pen mr-1"></i> Edit
                            </button>
                            <button
                              onClick={() => onDeleteRoom?.(room.id)}
                              className="px-2.5 py-1 text-red-500 hover:bg-red-50 rounded-lg text-[10px] font-black"
                              title="Delete Room"
                            >
                              <i className="fas fa-trash-alt mr-1"></i> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: HOTELS & ROOMS MANAGEMENT */}
      {activeSubTab === 'hotels' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="font-black text-[#001D4A] text-base">হোটেল ও রুম তালিকা (Hotels for {selectedTourName})</h4>
              <p className="text-xs text-gray-400 font-bold mt-0.5">
                {isAdmin ? 'হোটেল তৈরি, এডিট এবং ডিলিট করার নিয়ন্ত্রণ' : 'হোটেল ও রুমের বিস্তারিত তালিকা (Read-only)'}
              </p>
            </div>
            {isAdmin && (
              <button
                onClick={() => setShowAddHotelModal(true)}
                className="px-5 py-3 bg-[#001D4A] text-white rounded-2xl font-black text-xs uppercase flex items-center gap-2 shadow-md hover:bg-opacity-90 active:scale-95 transition-all"
              >
                <i className="fas fa-plus"></i> + নতুন হোটেল যোগ করুন
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {tourHotels.length === 0 ? (
              <div className="md:col-span-3 py-16 text-center bg-white rounded-[32px] border-2 border-dashed border-gray-200 p-8">
                <i className="fas fa-hotel text-4xl text-gray-300 mb-3"></i>
                <h5 className="font-black text-gray-600 text-base">কোনো হোটেল যোগ করা হয়নি</h5>
                <p className="text-gray-400 text-xs font-medium mt-1">
                  {isAdmin ? 'উপরে "+ নতুন হোটেল যোগ করুন" বাটনে ক্লিক করে হোটেল যুক্ত করুন।' : 'অ্যাডমিন এখনো কোনো হোটেল যুক্ত করেননি।'}
                </p>
              </div>
            ) : (
              tourHotels.map(hotel => (
                <div key={hotel.id} className="bg-white p-6 rounded-[28px] border border-gray-100 shadow-sm space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h5 className="font-black text-[#001D4A] text-base">{hotel.name}</h5>
                      <p className="text-gray-400 text-xs font-bold mt-0.5">{hotel.location || 'Location'}</p>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => setEditingHotel(hotel)}
                          className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs hover:bg-indigo-100"
                          title="Edit Hotel"
                        >
                          <i className="fas fa-pen"></i>
                        </button>
                        <button
                          onClick={() => onDeleteHotel?.(hotel.id)}
                          className="w-8 h-8 rounded-xl bg-red-50 text-red-500 flex items-center justify-center text-xs hover:bg-red-100"
                          title="Delete Hotel"
                        >
                          <i className="fas fa-trash-alt"></i>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 text-xs text-gray-600 font-medium">
                    {hotel.contactNumber && <p><i className="fas fa-phone mr-1 text-gray-400"></i> {hotel.contactNumber}</p>}
                    {hotel.address && <p><i className="fas fa-map-marker-alt mr-1 text-gray-400"></i> {hotel.address}</p>}
                  </div>

                  <div className="pt-3 border-t border-gray-100 flex justify-between items-center text-xs">
                    <span className="font-bold text-gray-400">
                      রুম সংখ্যা: {rooms.filter(r => r.hotelId === hotel.id).length}
                    </span>
                    {isAdmin && (
                      <button
                        onClick={() => {
                          setSelectedHotelForRoom(hotel.id);
                          setNewRoom(prev => ({ ...prev, hotelId: hotel.id }));
                          setShowAddRoomModal(true);
                        }}
                        className="text-indigo-600 font-black hover:underline"
                      >
                        + Add Room
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* VIEW 3: PRINT ROOM ALLOCATION SHEET */}
      {activeSubTab === 'print' && (
        <div className="bg-white p-8 rounded-[32px] border border-gray-200 shadow-sm space-y-6">
          <div className="flex justify-between items-center pb-4 border-b border-gray-200">
            <div>
              <h3 className="text-xl font-black text-[#001D4A]">
                হোটেল রুম অ্যালটমেন্ট রিপোর্ট (Hotel Allocation Sheet)
              </h3>
              <p className="text-xs text-gray-500 font-bold">ট্যুর: {selectedTourName}</p>
            </div>
            <button
              onClick={handlePrintAllocationSheet}
              className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-2xl font-black text-xs uppercase shadow-md flex items-center gap-2"
            >
              <i className="fas fa-print"></i>
              <span>Print A4 Sheet</span>
            </button>
          </div>

          {/* Printable Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#001D4A] text-white uppercase text-[10px] tracking-wider">
                  <th className="p-3 rounded-l-xl">Room No</th>
                  <th className="p-3">Room Type</th>
                  <th className="p-3">Capacity</th>
                  <th className="p-3">Hotel Name</th>
                  <th className="p-3">Occupants (Passenger Name & Seat)</th>
                  <th className="p-3 rounded-r-xl">Contact Mobile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tourRooms.map(room => {
                  const occupants = tourBookings.filter(b => (room.assignedBookingIds || []).includes(b.id));
                  return (
                    <tr key={room.id} className="hover:bg-gray-50 font-medium">
                      <td className="p-3 font-black text-sm text-[#001D4A]">Room {room.roomNo}</td>
                      <td className="p-3">{room.roomType}</td>
                      <td className="p-3">{occupants.length} / {room.capacity}</td>
                      <td className="p-3 font-bold">{room.hotelName}</td>
                      <td className="p-3">
                        {occupants.length === 0 ? (
                          <span className="text-gray-400 italic">-- Vacant --</span>
                        ) : (
                          <div className="space-y-1">
                            {occupants.map(occ => (
                              <div key={occ.id} className="flex items-center gap-2">
                                <span className="px-1.5 py-0.5 bg-gray-200 text-[#001D4A] font-black rounded text-[9px]">
                                  Seat {occ.seatNo}
                                </span>
                                <span className="font-bold">{occ.name}</span>
                                <span className="text-[9px] text-gray-500">({occ.gender}, {occ.religion})</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-gray-600 font-bold">
                        {occupants.map(o => o.mobile).filter(Boolean).join(', ') || '--'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Hotel Modal (Admin Only) */}
      {showAddHotelModal && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white p-6 md:p-8 rounded-3xl max-w-md w-full shadow-2xl space-y-4">
            <h4 className="font-black text-[#001D4A] text-lg">Add New Hotel</h4>
            <form onSubmit={handleCreateHotel} className="space-y-3">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase">Hotel Name *</label>
                <input
                  required
                  value={newHotel.name}
                  onChange={(e) => setNewHotel(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Resort RungRang"
                  className="w-full px-4 py-3 bg-gray-50 border rounded-xl text-xs font-bold outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase">Location</label>
                <input
                  value={newHotel.location}
                  onChange={(e) => setNewHotel(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="e.g. Sajek Valley"
                  className="w-full px-4 py-3 bg-gray-50 border rounded-xl text-xs font-bold outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase">Contact Phone</label>
                <input
                  value={newHotel.contactNumber}
                  onChange={(e) => setNewHotel(prev => ({ ...prev, contactNumber: e.target.value }))}
                  placeholder="01XXXXXXXXX"
                  className="w-full px-4 py-3 bg-gray-50 border rounded-xl text-xs font-bold outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase">Address / Remarks</label>
                <input
                  value={newHotel.address}
                  onChange={(e) => setNewHotel(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Address or notes"
                  className="w-full px-4 py-3 bg-gray-50 border rounded-xl text-xs font-bold outline-none"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddHotelModal(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-black text-xs uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-[#001D4A] text-white rounded-xl font-black text-xs uppercase shadow-md"
                >
                  Save Hotel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Hotel Modal (Admin Only) */}
      {editingHotel && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white p-6 md:p-8 rounded-3xl max-w-md w-full shadow-2xl space-y-4">
            <h4 className="font-black text-[#001D4A] text-lg">Edit Hotel Details</h4>
            <form onSubmit={handleSaveHotelEdit} className="space-y-3">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase">Hotel Name *</label>
                <input
                  required
                  value={editingHotel.name}
                  onChange={(e) => setEditingHotel(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                  placeholder="e.g. Resort RungRang"
                  className="w-full px-4 py-3 bg-gray-50 border rounded-xl text-xs font-bold outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase">Location</label>
                <input
                  value={editingHotel.location || ''}
                  onChange={(e) => setEditingHotel(prev => prev ? ({ ...prev, location: e.target.value }) : null)}
                  placeholder="e.g. Sajek Valley"
                  className="w-full px-4 py-3 bg-gray-50 border rounded-xl text-xs font-bold outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase">Contact Phone</label>
                <input
                  value={editingHotel.contactNumber || ''}
                  onChange={(e) => setEditingHotel(prev => prev ? ({ ...prev, contactNumber: e.target.value }) : null)}
                  placeholder="01XXXXXXXXX"
                  className="w-full px-4 py-3 bg-gray-50 border rounded-xl text-xs font-bold outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase">Address / Remarks</label>
                <input
                  value={editingHotel.address || ''}
                  onChange={(e) => setEditingHotel(prev => prev ? ({ ...prev, address: e.target.value }) : null)}
                  placeholder="Address or notes"
                  className="w-full px-4 py-3 bg-gray-50 border rounded-xl text-xs font-bold outline-none"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingHotel(null)}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-black text-xs uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase shadow-md"
                >
                  Update Hotel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Room Modal (Admin Only) */}
      {showAddRoomModal && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white p-6 md:p-8 rounded-3xl max-w-md w-full shadow-2xl space-y-4">
            <h4 className="font-black text-[#001D4A] text-lg">Add New Room</h4>
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase">Room Number *</label>
                <input
                  required
                  value={newRoom.roomNo}
                  onChange={(e) => setNewRoom(prev => ({ ...prev, roomNo: e.target.value }))}
                  placeholder="e.g. 101, 202, 305"
                  className="w-full px-4 py-3 bg-gray-50 border rounded-xl text-xs font-bold outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase">Room Type (রুমের ধরন)</label>
                <select
                  value={newRoom.roomType}
                  onChange={(e) => handleRoomTypeSelect(e.target.value as RoomType, false)}
                  className="w-full px-4 py-3 bg-gray-50 border rounded-xl text-xs font-black text-[#001D4A] outline-none"
                >
                  <option value="Single">Single Room (১ জন)</option>
                  <option value="Couple">Couple Room (২ জন)</option>
                  <option value="Combine4">Combine Room - 4 Bed (৪ জন)</option>
                  <option value="Combine5">Combine Room - 5 Bed (৫ জন)</option>
                  <option value="Combine6">Combine Room - 6 Bed (৬ জন)</option>
                  <option value="Custom">Custom Capacity</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase">Capacity (জন)</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={newRoom.capacity}
                    onChange={(e) => setNewRoom(prev => ({ ...prev, capacity: Number(e.target.value) }))}
                    className="w-full px-4 py-3 bg-gray-50 border rounded-xl text-xs font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase">Floor / ভবনের তলা</label>
                  <input
                    value={newRoom.floor}
                    onChange={(e) => setNewRoom(prev => ({ ...prev, floor: e.target.value }))}
                    placeholder="1st Floor"
                    className="w-full px-4 py-3 bg-gray-50 border rounded-xl text-xs font-bold outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase">Hotel</label>
                <select
                  value={newRoom.hotelId || selectedHotelForRoom}
                  onChange={(e) => setNewRoom(prev => ({ ...prev, hotelId: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-50 border rounded-xl text-xs font-bold outline-none"
                >
                  {tourHotels.map(h => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddRoomModal(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-black text-xs uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-[#001D4A] text-white rounded-xl font-black text-xs uppercase shadow-md"
                >
                  Add Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Room Modal (Admin Only) */}
      {editingRoom && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white p-6 md:p-8 rounded-3xl max-w-md w-full shadow-2xl space-y-4">
            <h4 className="font-black text-[#001D4A] text-lg">Edit Room Details</h4>
            <form onSubmit={handleSaveRoomEdit} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase">Room Number *</label>
                <input
                  required
                  value={editingRoom.roomNo}
                  onChange={(e) => setEditingRoom(prev => prev ? ({ ...prev, roomNo: e.target.value }) : null)}
                  placeholder="e.g. 101, 202, 305"
                  className="w-full px-4 py-3 bg-gray-50 border rounded-xl text-xs font-bold outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase">Room Type (রুমের ধরন)</label>
                <select
                  value={editingRoom.roomType}
                  onChange={(e) => handleRoomTypeSelect(e.target.value as RoomType, true)}
                  className="w-full px-4 py-3 bg-gray-50 border rounded-xl text-xs font-black text-[#001D4A] outline-none"
                >
                  <option value="Single">Single Room (১ জন)</option>
                  <option value="Couple">Couple Room (২ জন)</option>
                  <option value="Combine4">Combine Room - 4 Bed (৪ জন)</option>
                  <option value="Combine5">Combine Room - 5 Bed (৫ জন)</option>
                  <option value="Combine6">Combine Room - 6 Bed (৬ জন)</option>
                  <option value="Custom">Custom Capacity</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase">Capacity (জন)</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={editingRoom.capacity}
                    onChange={(e) => setEditingRoom(prev => prev ? ({ ...prev, capacity: Number(e.target.value) }) : null)}
                    className="w-full px-4 py-3 bg-gray-50 border rounded-xl text-xs font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase">Floor / ভবনের তলা</label>
                  <input
                    value={editingRoom.floor || ''}
                    onChange={(e) => setEditingRoom(prev => prev ? ({ ...prev, floor: e.target.value }) : null)}
                    placeholder="1st Floor"
                    className="w-full px-4 py-3 bg-gray-50 border rounded-xl text-xs font-bold outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase">Hotel</label>
                <select
                  value={editingRoom.hotelId}
                  onChange={(e) => {
                    const selH = hotels.find(h => h.id === e.target.value);
                    setEditingRoom(prev => prev ? ({ ...prev, hotelId: e.target.value, hotelName: selH?.name || prev.hotelName }) : null);
                  }}
                  className="w-full px-4 py-3 bg-gray-50 border rounded-xl text-xs font-bold outline-none"
                >
                  {tourHotels.map(h => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRoom(null)}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-black text-xs uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase shadow-md"
                >
                  Update Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HotelManager;
