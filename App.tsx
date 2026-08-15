import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BUSINESS_INFO, DEFAULT_BUS_LAYOUT, DEFAULT_HOTELS, DEFAULT_ROOMS, generateSeatsFromLayout } from './constants';
import { BusData, BookingInfo, Tour, Booker, CustomerType, Expense, SeatLock, BusCustomLayout, Hotel, HotelRoom } from './types';
import { motion, AnimatePresence } from 'motion/react';
import BusLayout from './components/BusLayout';
import BookingModal from './components/BookingModal';
import ConfirmationDialog from './components/ConfirmationDialog';
import Dashboard from './components/Dashboard';
import BookingLog from './components/BookingLog';
import EditData from './components/EditData';
import AdminPanel from './components/AdminPanel';
import SeatDetailModal from './components/SeatDetailModal';
import ExpenseTracker from './components/ExpenseTracker';
import RevenueReport from './components/RevenueReport';
import HotelManager from './components/HotelManager';
import { supabase } from './supabase';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'booking' | 'dashboard' | 'log' | 'edit' | 'admin' | 'expenses' | 'revenue' | 'rooms'>('booking');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => {
    return sessionStorage.getItem('tl_auth_admin') === 'true' || localStorage.getItem('tl_auth_admin') === 'true';
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);

  const [authenticatedAgent, setAuthenticatedAgent] = useState<Booker | null>(() => {
    const savedSession = sessionStorage.getItem('tl_auth_agent');
    const savedLocal = localStorage.getItem('tl_auth_agent');
    const saved = savedSession || savedLocal;
    return saved ? JSON.parse(saved) : null;
  });
  
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const notify = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  const [entryCodeInput, setEntryCodeInput] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  const [selectedBusIndex, setSelectedBusIndex] = useState(0);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingInfo, setEditingInfo] = useState<BookingInfo | null>(null);

  // Bus Layout State & Hotel State
  const [busLayout, setBusLayout] = useState<BusCustomLayout>(() => {
    const saved = localStorage.getItem('tl_bus_layout');
    return saved ? JSON.parse(saved) : DEFAULT_BUS_LAYOUT;
  });

  const [busLayoutsByTour, setBusLayoutsByTour] = useState<Record<string, BusCustomLayout>>(() => {
    const saved = localStorage.getItem('tl_bus_layouts_by_tour');
    return saved ? JSON.parse(saved) : {};
  });

  const [hotels, setHotels] = useState<Hotel[]>(() => {
    const saved = localStorage.getItem('tl_hotels');
    return saved ? JSON.parse(saved) : DEFAULT_HOTELS;
  });

  const [rooms, setRooms] = useState<HotelRoom[]>(() => {
    const saved = localStorage.getItem('tl_hotel_rooms');
    return saved ? JSON.parse(saved) : DEFAULT_ROOMS;
  });

  const [tours, setTours] = useState<Tour[]>([]);
  const [bookers, setBookers] = useState<Booker[]>([]);
  const [customerTypes, setCustomerTypes] = useState<CustomerType[]>([]);
  const [buses, setBuses] = useState<BusData[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [onlineAgents, setOnlineAgents] = useState<Booker[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);

  // Get active layout for currently selected tour
  const currentTourName = tours[selectedBusIndex]?.name || '';
  const activeLayoutForSelectedBus = useMemo(() => {
    if (currentTourName && busLayoutsByTour[currentTourName]) {
      return busLayoutsByTour[currentTourName];
    }
    return busLayout;
  }, [currentTourName, busLayoutsByTour, busLayout]);

  // Derived flat bookings list across all tours
  const allBookings = useMemo(() => {
    return buses.flatMap(b => b.seats.filter(s => s.isBooked && s.bookingInfo).map(s => s.bookingInfo!));
  }, [buses]);

  const fetchData = useCallback(async () => {
    try {
      // Clean up expired locks globally to keep the table small
      try {
        await supabase.from('tl_locks').delete().lt('expires_at', new Date().toISOString());
      } catch (e) {
        // ignore lock clean up error
      }

      const [toursRes, bookersRes, typesRes, bookingsRes, expensesRes, locksRes, noticesRes] = await Promise.all([
        supabase.from('tl_tours').select('*'),
        supabase.from('tl_agents').select('*'),
        supabase.from('tl_customer_types').select('*'),
        supabase.from('tl_bookings').select('*'),
        supabase.from('tl_expenses').select('*'),
        supabase.from('tl_locks').select('*'),
        supabase.from('tl_notices').select('*')
      ]);

      const fetchedTours = (toursRes.data || []).sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      const fetchedBookers = (bookersRes.data || []).sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
      const fetchedTypes = (typesRes.data || []).sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      const fetchedBookings: any[] = bookingsRes.data || [];
      const fetchedLocks: any[] = locksRes.data || [];
      const fetchedNotices: any[] = (noticesRes.data || []).filter((n: any) => n.is_active !== false);

      const now = new Date();
      const validLocks: SeatLock[] = fetchedLocks.filter(lock => new Date(lock.expires_at) > now);

      const onlineCutoff = new Date(Date.now() - 2 * 60 * 1000);
      const activeAgents = fetchedBookers.filter((b: any) => b.last_active && new Date(b.last_active) > onlineCutoff);
      setOnlineAgents(activeAgents);
      setNotifications(fetchedNotices);

      // Group & Room local metadata fallback
      const groupMeta: Record<string, any> = JSON.parse(localStorage.getItem('tl_booking_meta') || '{}');

      const mappedBookings: BookingInfo[] = fetchedBookings.map(b => {
        const meta = groupMeta[b.id] || {};
        return {
          id: b.id,
          name: b.name,
          mobile: b.mobile,
          address: b.address,
          gender: b.gender,
          religion: b.religion,
          tourName: b.tour_name,
          tourFees: b.tour_fees,
          customerType: b.customer_type,
          customerTypeFees: b.customer_type_fees,
          discountAmount: b.discount_amount,
          advanceAmount: b.advance_amount,
          dueAmount: b.due_amount,
          paymentStatus: b.payment_status,
          busNo: b.bus_no,
          seatNo: b.seat_no,
          bookedBy: b.booked_by,
          bookerCode: b.booker_code,
          bookingDate: b.booking_date,
          isPrimary: b.is_primary !== undefined ? b.is_primary : (meta.isPrimary ?? true),
          primaryBookingId: b.primary_booking_id || meta.primaryBookingId,
          totalGroupSeats: b.total_group_seats || meta.totalGroupSeats || 1,
          groupSeatsList: b.group_seats_list || meta.groupSeatsList,
          hotelRoomNo: b.hotel_room_no || meta.hotelRoomNo,
          hotelName: b.hotel_name || meta.hotelName
        };
      });

      setTours(fetchedTours);
      setBookers(fetchedBookers);
      setCustomerTypes(fetchedTypes);
      setExpenses((expensesRes.data || []).map((ex: any) => ({
        id: ex.id, category: ex.category, amount: ex.amount, description: ex.description,
        date: ex.date, recordedBy: ex.recorded_by, agentCode: ex.agent_code, tourName: ex.tour_name
      })));

      const busLayouts = fetchedTours.map(t => {
        const layoutToUse = busLayoutsByTour[t.name] || busLayout;
        const seats = generateSeatsFromLayout(layoutToUse);
        mappedBookings.forEach(booking => {
          if (booking.busNo === t.name || booking.tourName === t.name) {
            const seatIdx = seats.findIndex(s => s.id === booking.seatNo);
            if (seatIdx !== -1) {
              seats[seatIdx] = { ...seats[seatIdx], isBooked: true, bookingInfo: booking };
            }
          }
        });
        validLocks.forEach(lock => {
          if (lock.bus_no === t.name) {
            const seatIdx = seats.findIndex(s => s.id === lock.seat_no);
            if (seatIdx !== -1 && !seats[seatIdx].isBooked) {
              seats[seatIdx] = { ...seats[seatIdx], lockInfo: lock };
            }
          }
        });
        return { busId: t.name, seats };
      });
      setBuses(busLayouts);
    } catch (error) {
      console.error("Fetch Error:", error);
    } finally {
      setIsLoading(false);
    }
  }, [busLayout, busLayoutsByTour]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    const channel = supabase.channel('tl_realtime')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => fetchData())
      .subscribe();
    return () => { 
      clearInterval(interval);
      supabase.removeChannel(channel); 
    };
  }, [fetchData]);

  useEffect(() => {
    if (!authenticatedAgent || authenticatedAgent.code === 'ADMIN') return;
    const heartbeat = setInterval(async () => {
      await supabase.from('tl_agents').update({ last_active: new Date().toISOString() }).eq('code', authenticatedAgent.code);
    }, 30000);
    return () => clearInterval(heartbeat);
  }, [authenticatedAgent]);

  // Handle seat clicks on Bus Layout
  const handleSeatClick = async (sid: string) => {
    const currentBus = buses[selectedBusIndex];
    if (!currentBus) return;
    const seat = currentBus.seats.find(s => s.id === sid);

    // If already booked, open details modal
    if (seat?.isBooked) {
      setEditingInfo(seat.bookingInfo!);
      setShowDetailModal(true);
      return;
    }

    // If locked by another agent
    if (seat?.lockInfo && seat.lockInfo.agent_code !== authenticatedAgent?.code) {
      notify(`Seat taken by ${seat.lockInfo.agent_name}`, 'error');
      return;
    }

    // Toggle multi-seat selection
    setSelectedSeatIds(prev => {
      if (prev.includes(sid)) {
        return prev.filter(id => id !== sid);
      } else {
        return [...prev, sid];
      }
    });
  };

  // User clicks "Proceed to Book" with selected seats
  const handleProceedBooking = async (seatIds?: string[] | any) => {
    const seatsToBook: string[] = Array.isArray(seatIds) 
      ? seatIds 
      : (Array.isArray(selectedSeatIds) ? selectedSeatIds : []);
    if (seatsToBook.length === 0) return;
    const currentBus = buses[selectedBusIndex];
    if (!currentBus) return;

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    try {
      // Clear expired locks first
      await supabase.from('tl_locks')
        .delete()
        .eq('bus_no', currentBus.busId)
        .in('seat_no', seatsToBook)
        .lt('expires_at', new Date().toISOString());

      // Acquire locks for selected seats
      const lockInserts = seatsToBook.map(sId => ({
        bus_no: currentBus.busId,
        seat_no: sId,
        agent_code: authenticatedAgent?.code || 'GUEST',
        agent_name: authenticatedAgent?.name || 'Guest',
        expires_at: expiresAt
      }));

      await supabase.from('tl_locks').upsert(lockInserts);
      setSelectedSeatIds(seatsToBook);
      setShowBookingModal(true);
    } catch (e) {
      notify("Securing seats for booking...", 'info');
      setSelectedSeatIds(seatsToBook);
      setShowBookingModal(true);
    }
  };

  const releaseLocks = async (busNo: string, seatIds: string[]) => {
    if (!authenticatedAgent || seatIds.length === 0) return;
    try {
      await supabase.from('tl_locks')
        .delete()
        .eq('bus_no', busNo)
        .in('seat_no', seatIds)
        .eq('agent_code', authenticatedAgent.code);
    } catch (e) {
      console.error(e);
    }
    fetchData();
  };

  // Submit multi-seat bookings
  const handleMultiBookingSubmit = async (bookings: BookingInfo[]) => {
    if (!bookings || bookings.length === 0) return;
    try {
      // Save group and hotel metadata locally so it's always preserved seamlessly
      try {
        const groupMeta: Record<string, any> = JSON.parse(localStorage.getItem('tl_booking_meta') || '{}');
        bookings.forEach(b => {
          groupMeta[b.id] = {
            isPrimary: b.isPrimary,
            primaryBookingId: b.primaryBookingId,
            totalGroupSeats: b.totalGroupSeats,
            groupSeatsList: b.groupSeatsList,
            hotelRoomNo: b.hotelRoomNo,
            hotelName: b.hotelName
          };
        });
        localStorage.setItem('tl_booking_meta', JSON.stringify(groupMeta));
      } catch (e) {
        console.error("Local meta error:", e);
      }

      const recordsToUpsert = bookings.map(info => ({
        id: info.id,
        name: info.name,
        mobile: info.mobile,
        address: info.address || '',
        gender: info.gender,
        religion: info.religion,
        tour_name: info.tourName,
        tour_fees: info.tourFees,
        customer_type: info.customerType,
        customer_type_fees: info.customerTypeFees,
        discount_amount: info.discountAmount,
        advance_amount: info.advanceAmount,
        due_amount: info.dueAmount,
        payment_status: info.paymentStatus,
        bus_no: info.busNo,
        seat_no: info.seatNo,
        booked_by: info.bookedBy,
        booker_code: info.bookerCode,
        booking_date: info.bookingDate,
        is_primary: info.isPrimary,
        primary_booking_id: info.primaryBookingId,
        total_group_seats: info.totalGroupSeats,
        group_seats_list: info.groupSeatsList,
        hotel_room_no: info.hotelRoomNo,
        hotel_name: info.hotelName
      }));

      let { error } = await supabase.from('tl_bookings').upsert(recordsToUpsert);

      // If Supabase schema lacks the new extended columns (PGRST204), fallback to core columns
      if (error && (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('schema cache'))) {
        console.warn("Supabase table missing extended columns, executing fallback upsert:", error.message);
        const fallbackRecords = recordsToUpsert.map(r => ({
          id: r.id,
          name: r.name,
          mobile: r.mobile,
          address: r.address,
          gender: r.gender,
          religion: r.religion,
          tour_name: r.tour_name,
          tour_fees: r.tour_fees,
          customer_type: r.customer_type,
          customer_type_fees: r.customer_type_fees,
          discount_amount: r.discount_amount,
          advance_amount: r.advance_amount,
          due_amount: r.due_amount,
          payment_status: r.payment_status,
          bus_no: r.bus_no,
          seat_no: r.seat_no,
          booked_by: r.booked_by,
          booker_code: r.booker_code,
          booking_date: r.booking_date
        }));
        const retryRes = await supabase.from('tl_bookings').upsert(fallbackRecords);
        error = retryRes.error;
      }

      if (error) throw error;
      
      const busNo = bookings[0].busNo;
      const seatIds = bookings.map(b => b.seatNo);
      await releaseLocks(busNo, seatIds);

      // If hotel room was assigned during booking, update room state
      const targetRoomNo = bookings[0]?.hotelRoomNo;
      if (targetRoomNo) {
        setRooms(prevRooms => prevRooms.map(rm => {
          if (rm.roomNo === targetRoomNo && (rm.tourName === bookings[0].tourName || rm.tourName === busNo)) {
            const currentAssigned = rm.assignedBookingIds || [];
            const newIds = bookings.map(b => b.id).filter(id => !currentAssigned.includes(id));
            return { ...rm, assignedBookingIds: [...currentAssigned, ...newIds] };
          }
          return rm;
        }));
      }

      fetchData();
      notify(`Booking successful for ${bookings.length} seat(s)!`, 'success');
    } catch (error) {
      console.error(error);
      notify("Booking failed to save.", 'error');
    }
    setSelectedSeatIds([]);
    setShowBookingModal(false);
    setShowDetailModal(false);
    setEditingInfo(null);
  };

  const handleSingleBookingSubmit = async (info: BookingInfo) => {
    await handleMultiBookingSubmit([info]);
  };

  const handleBookingDelete = async (busId: string, seatId: string) => {
    if (!isAdminAuthenticated) return;
    try {
      const { error } = await supabase.from('tl_bookings').delete().eq('bus_no', busId).eq('seat_no', seatId);
      if (error) throw error;
      fetchData();
      notify("Booking removed.", 'success');
    } catch (error) {
      notify("Delete failed.", 'error');
    }
  };

  const handleBulkDelete = async (ids: string[]) => {
    if (!isAdminAuthenticated) return;
    try {
      const { error } = await supabase.from('tl_bookings').delete().in('id', ids);
      if (error) throw error;
      fetchData();
      notify(`Deleted ${ids.length} bookings.`, 'success');
    } catch (error) {
      notify("Bulk delete failed.", 'error');
    }
  };

  // Bus Layout Customizer Handler
  const handleSaveBusLayout = (layout: BusCustomLayout, applyToTour?: string) => {
    if (applyToTour) {
      const updatedTourLayouts = { ...busLayoutsByTour, [applyToTour]: layout };
      setBusLayoutsByTour(updatedTourLayouts);
      localStorage.setItem('tl_bus_layouts_by_tour', JSON.stringify(updatedTourLayouts));
    } else {
      setBusLayout(layout);
      localStorage.setItem('tl_bus_layout', JSON.stringify(layout));
    }
    fetchData();
  };

  // Hotel & Room Management Handlers
  const handleAddHotel = (hotel: Hotel) => {
    if (!isAdminAuthenticated) {
      notify("Only admin can create hotels.", 'error');
      return;
    }
    const updated = [...hotels, hotel];
    setHotels(updated);
    localStorage.setItem('tl_hotels', JSON.stringify(updated));
  };

  const handleUpdateHotel = (hotel: Hotel) => {
    if (!isAdminAuthenticated) {
      notify("Only admin can update hotels.", 'error');
      return;
    }
    const updated = hotels.map(h => h.id === hotel.id ? hotel : h);
    setHotels(updated);
    localStorage.setItem('tl_hotels', JSON.stringify(updated));
  };

  const handleDeleteHotel = (hotelId: string) => {
    if (!isAdminAuthenticated) {
      notify("Only admin can delete hotels.", 'error');
      return;
    }
    const updated = hotels.filter(h => h.id !== hotelId);
    setHotels(updated);
    localStorage.setItem('tl_hotels', JSON.stringify(updated));
  };

  const handleAddRoom = (room: HotelRoom) => {
    if (!isAdminAuthenticated) {
      notify("Only admin can create rooms.", 'error');
      return;
    }
    const updated = [...rooms, room];
    setRooms(updated);
    localStorage.setItem('tl_hotel_rooms', JSON.stringify(updated));
  };

  const handleUpdateRoom = (room: HotelRoom) => {
    if (!isAdminAuthenticated) {
      notify("Only admin can update rooms.", 'error');
      return;
    }
    const updated = rooms.map(r => r.id === room.id ? room : r);
    setRooms(updated);
    localStorage.setItem('tl_hotel_rooms', JSON.stringify(updated));
  };

  const handleDeleteRoom = (roomId: string) => {
    if (!isAdminAuthenticated) {
      notify("Only admin can delete rooms.", 'error');
      return;
    }
    const updated = rooms.filter(r => r.id !== roomId);
    setRooms(updated);
    localStorage.setItem('tl_hotel_rooms', JSON.stringify(updated));
  };

  const handleAssignPassenger = (roomId: string, bookingId: string) => {
    const updatedRooms = rooms.map(r => {
      const currentAssigned = r.assignedBookingIds || [];
      if (r.id === roomId) {
        if (!currentAssigned.includes(bookingId)) {
          return { ...r, assignedBookingIds: [...currentAssigned, bookingId] };
        }
      } else {
        // remove from any previous room
        return { ...r, assignedBookingIds: currentAssigned.filter(id => id !== bookingId) };
      }
      return r;
    });
    setRooms(updatedRooms);
    localStorage.setItem('tl_hotel_rooms', JSON.stringify(updatedRooms));
    notify("Passenger assigned to room!", 'success');
  };

  const handleUnassignPassenger = (roomId: string, bookingId: string) => {
    const updatedRooms = rooms.map(r => {
      if (r.id === roomId) {
        return { ...r, assignedBookingIds: (r.assignedBookingIds || []).filter(id => id !== bookingId) };
      }
      return r;
    });
    setRooms(updatedRooms);
    localStorage.setItem('tl_hotel_rooms', JSON.stringify(updatedRooms));
    notify("Passenger removed from room.", 'info');
  };

  // Admin Master Data Handlers
  const handleTourUpsert = async (tour: Tour) => {
    try {
      const fullPayload = { 
        name: tour.name, 
        fee: tour.fee,
        tour_type: tour.tour_type || 'Day Long',
        couple_extra_fee: tour.couple_extra_fee || 0,
        hotel_name: tour.hotel_name || null,
        sort_order: tour.sort_order || 0
      };
      let { error } = await supabase.from('tl_tours').upsert(fullPayload, { onConflict: 'name' });
      if (error && (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('schema cache'))) {
        const basePayload = { name: tour.name, fee: tour.fee };
        const retry = await supabase.from('tl_tours').upsert(basePayload, { onConflict: 'name' });
        error = retry.error;
      }
      if (error) throw error;
      fetchData();
      notify("Tour updated", 'success');
    } catch (e) { notify("Failed to save tour.", 'error'); }
  };

  const handleTourDelete = async (name: string) => {
    setConfirmDialog({
      message: `Warning: Deleting tour "${name}" will remove it from future selections. Existing bookings for this tour will remain in logs. Continue?`,
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('tl_tours').delete().eq('name', name);
          if (error) throw error;
          fetchData();
          notify("Tour deleted", 'success');
        } catch (e) { notify("Failed to delete tour.", 'error'); }
        setConfirmDialog(null);
      }
    });
  };

  const handleAgentUpsert = async (agent: Booker) => {
    try {
      const { error } = await supabase.from('tl_agents').upsert({ code: agent.code, name: agent.name }, { onConflict: 'code' });
      if (error) throw error;
      fetchData();
      notify("Agent saved successfully!", 'success');
    } catch (e) { notify("Failed to save agent.", 'error'); }
  };

  const handleAgentDelete = async (code: string) => {
    try {
      const { error } = await supabase.from('tl_agents').delete().eq('code', code);
      if (error) throw error;
      fetchData();
      notify("Agent removed.", 'success');
    } catch (e) { notify("Failed to delete agent.", 'error'); }
  };

  const handleCustomerTypeUpsert = async (type: CustomerType) => {
    try {
      const fullPayload = { 
        type: type.type, 
        fee: type.fee,
        sort_order: type.sort_order || 0,
        tour_name: type.tour_name || null
      };
      let { error } = await supabase.from('tl_customer_types').upsert(fullPayload, { onConflict: 'type' });
      if (error && (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('schema cache'))) {
        const basePayload = { type: type.type, fee: type.fee };
        const retry = await supabase.from('tl_customer_types').upsert(basePayload, { onConflict: 'type' });
        error = retry.error;
      }
      if (error) throw error;
      fetchData();
      notify("Pricing type updated.", 'success');
    } catch (e) { notify("Failed to save pricing type.", 'error'); }
  };

  const handleCustomerTypeDelete = async (type: string) => {
    try {
      const { error } = await supabase.from('tl_customer_types').delete().eq('type', type);
      if (error) throw error;
      fetchData();
      notify("Pricing type removed.", 'success');
    } catch (e) { notify("Failed to delete pricing type.", 'error'); }
  };

  const handleExpenseSubmit = async (ex: Expense) => {
    try {
      const fullPayload = {
        id: ex.id, category: ex.category, amount: ex.amount, description: ex.description,
        date: ex.date, recorded_by: ex.recordedBy, agent_code: ex.agentCode, tour_name: ex.tourName || null
      };
      let { error } = await supabase.from('tl_expenses').upsert(fullPayload);
      if (error && (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('schema cache'))) {
        const basePayload = {
          id: ex.id, category: ex.category, amount: ex.amount, description: ex.description,
          date: ex.date, recorded_by: ex.recordedBy, agent_code: ex.agentCode
        };
        const retry = await supabase.from('tl_expenses').upsert(basePayload);
        error = retry.error;
      }
      if (error) throw error;
      fetchData();
    } catch (e) {
      notify("Failed to save expense.", 'error');
    }
  };

  const handleExpenseDelete = async (id: string) => {
    if (!isAdminAuthenticated) return;
    try {
      const { error } = await supabase.from('tl_expenses').delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (e) {
      notify("Delete failed.", 'error');
    }
  };

  const handleClearExpenses = async () => {
    if (!isAdminAuthenticated) return;
    setConfirmDialog({
      message: "Are you sure you want to clear ALL expense data? This cannot be undone.",
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('tl_expenses').delete().neq('id', '0');
          if (error) throw error;
          fetchData();
          notify("All expenses cleared.", 'success');
        } catch (e) {
          notify("Failed to clear expenses.", 'error');
        }
        setConfirmDialog(null);
      }
    });
  };

  const handleNoticeDeactivate = async (id: string) => {
    try {
      const { error } = await supabase.from('tl_notices').update({ is_active: false }).eq('id', id);
      if (error) throw error;
      fetchData();
      notify("Broadcast ended.", 'success');
    } catch (e) {
      notify("Failed to deactivate notice.", 'error');
    }
  };

  const handleEntryLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (entryCodeInput === "@Rana&01625@") {
      const adminAgent: Booker = { code: 'ADMIN', name: 'System Administrator' };
      setAuthenticatedAgent(adminAgent);
      setIsAdminAuthenticated(true);
      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem('tl_auth_admin', 'true');
      storage.setItem('tl_auth_agent', JSON.stringify(adminAgent));
      setEntryCodeInput('');
      return;
    }
    const agent = bookers.find(b => b.code.toUpperCase() === entryCodeInput.toUpperCase());
    if (agent) {
      setAuthenticatedAgent(agent);
      setIsAdminAuthenticated(false);
      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem('tl_auth_agent', JSON.stringify(agent));
      storage.setItem('tl_auth_admin', 'false');
      setEntryCodeInput('');
      notify(`Welcome back, ${agent.name}`, 'success');
    } else {
      notify("Identity Invalid. Please check your code.", 'error');
    }
  };

  if (!authenticatedAgent) {
    return (
      <div className="min-h-screen bg-[#001D4A] flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>
        <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl p-10 relative z-10 animate-in zoom-in duration-500">
           <div className="flex flex-col items-center mb-10">
              <img src={BUSINESS_INFO.logo} alt="Logo" className="w-24 mb-6" />
              <h1 className="text-3xl font-black text-[#001D4A] tracking-tighter uppercase leading-none">{BUSINESS_INFO.name}</h1>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">Cloud Registry & Management System</p>
           </div>

           <form onSubmit={handleEntryLogin} className="space-y-6">
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Access Identity</label>
                 <input 
                    required
                    type="password"
                    placeholder="ENTER CODE"
                    value={entryCodeInput}
                    onChange={(e) => setEntryCodeInput(e.target.value)}
                    className="w-full px-6 py-5 bg-gray-50 border-none rounded-3xl font-black text-center text-xl tracking-[0.2em] uppercase focus:ring-4 focus:ring-orange-500/10 transition-all outline-none"
                 />
              </div>

              <div className="flex items-center gap-2 px-2">
                 <input 
                    type="checkbox" 
                    id="remember" 
                    checked={rememberMe} 
                    onChange={(e) => setRememberMe(e.target.checked)} 
                    className="w-4 h-4 rounded border-gray-200 text-orange-500" 
                 />
                 <label htmlFor="remember" className="text-[10px] font-black text-gray-400 uppercase tracking-widest cursor-pointer">Remember Me</label>
              </div>

              <button type="submit" className="w-full py-5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-[24px] font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-orange-500/20 active:scale-95 transition-all">
                Enter System
              </button>
           </form>

           <div className="mt-12 text-center">
              <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest">Developed by MASUD RANA</p>
           </div>
        </div>
      </div>
    );
  }

  const navItems = [
    { id: 'dashboard', icon: 'fa-chart-line', label: 'Stats' },
    { id: 'booking', icon: 'fa-bus', label: 'Seats' },
    { id: 'revenue', icon: 'fa-sack-dollar', label: 'Cash' },
    { id: 'expenses', icon: 'fa-file-invoice-dollar', label: 'Cost' },
    { id: 'rooms', icon: 'fa-hotel', label: 'Rooms' },
    { id: 'log', icon: 'fa-clipboard-list', label: 'Log' },
    { id: 'edit', icon: 'fa-user-pen', label: 'Edit' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Desktop Sidebar Navigation */}
      <nav className="hidden md:flex fixed top-0 left-0 bottom-0 w-24 bg-[#001D4A] flex-col items-center justify-between py-8 shadow-2xl z-50">
        <div className="flex flex-col items-center w-full">
          <img src={BUSINESS_INFO.logo} alt="Logo" className="w-14 mb-12" />
          {navItems.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id as any)} className={`w-full py-5 flex flex-col items-center transition-all ${activeTab === item.id ? 'bg-orange-500 text-white shadow-lg' : 'text-white/40 hover:text-white/80'}`}>
              <i className={`fas ${item.icon} text-xl mb-1`}></i>
              <span className="text-[9px] font-black uppercase">{item.label}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-col items-center gap-6">
          {isAdminAuthenticated && (
            <button onClick={() => setActiveTab('admin')} className={`w-14 h-14 flex items-center justify-center rounded-2xl transition-all ${activeTab === 'admin' ? 'bg-orange-500 text-white shadow-lg' : 'bg-white/5 text-white/40 hover:text-white'}`}>
              <i className="fas fa-user-shield text-xl"></i>
            </button>
          )}
          <button onClick={() => setShowLogoutConfirm(true)} className="w-14 h-14 flex items-center justify-center rounded-2xl bg-red-500/10 text-red-500 hover:bg-red-500/20"><i className="fas fa-power-off text-xl"></i></button>
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[75px] bg-[#001D4A]/95 backdrop-blur-md flex items-center justify-around z-[100] border-t border-white/10 shadow-[0_-10px_30px_rgba(0,0,0,0.3)] px-1 pb-safe">
        {navItems.map(item => (
          <button key={item.id} onClick={() => setActiveTab(item.id as any)} className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all py-2 rounded-2xl mx-0.5 ${activeTab === item.id ? 'bg-orange-500 text-white shadow-lg' : 'text-white/30'}`}>
            <i className={`fas ${item.icon} text-lg`}></i>
            <span className="text-[7px] font-black uppercase tracking-tight">{item.label}</span>
          </button>
        ))}
        {isAdminAuthenticated && (
          <button onClick={() => setActiveTab('admin')} className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all py-2 rounded-2xl mx-0.5 ${activeTab === 'admin' ? 'bg-orange-500 text-white shadow-lg' : 'text-white/30'}`}>
            <i className="fas fa-user-shield text-lg"></i>
            <span className="text-[7px] font-black uppercase tracking-tight">Admin</span>
          </button>
        )}
      </nav>

      <main className="flex-grow md:ml-24 p-4 md:p-10 pb-24 md:pb-10">
        <header className="flex justify-between items-center mb-6 md:mb-10">
          <div className="flex items-center gap-3">
            <div className="md:hidden w-10 h-10 bg-white p-2 rounded-xl shadow-sm"><img src={BUSINESS_INFO.logo} className="w-full" /></div>
            <div>
              <h2 className="text-xl md:text-3xl font-black text-[#001D4A] uppercase tracking-tighter leading-none">
                {activeTab === 'booking' ? 'Seat Plan & Booking' : activeTab === 'rooms' ? 'Hotel & Room Allocation' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                <p className="text-[8px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Online: {onlineAgents.map(a => a.name).join(', ') || 'No active agents'}
                </p>
              </div>
            </div>
          </div>
          <button onClick={() => setShowLogoutConfirm(true)} className="md:hidden w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center"><i className="fas fa-power-off"></i></button>
        </header>

        <div className="max-w-7xl mx-auto">
          {/* Notice Board */}
          {notifications.length > 0 && (
            <div className="mb-8 overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div 
                  key={notifications[0].id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`p-4 md:p-6 rounded-[32px] border border-white/20 flex items-center gap-4 relative overflow-hidden backdrop-blur-md shadow-xl ${
                    notifications[0].type === 'error' ? 'bg-red-500 text-white' : 
                    notifications[0].type === 'success' ? 'bg-green-500 text-white' : 
                    'bg-[#001D4A] text-white'
                  }`}
                >
                  <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                    <i className="fas fa-bullhorn text-sm animate-bounce text-orange-400"></i>
                  </div>
                  <div className="flex-1">
                    <p className="text-[8px] md:text-[9px] font-black uppercase tracking-widest opacity-60 mb-0.5">Live Alert Broadcast</p>
                    <p className="text-sm md:text-base font-bold tracking-tight">{notifications[0].content}</p>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          )}

          {/* TAB 1: SEAT PLAN & MULTI-SEAT BOOKING */}
          {activeTab === 'booking' && (
            <div className="animate-in fade-in duration-500 space-y-6">
              {/* Tour / Route Selector Bar */}
              <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-40">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Route:</span>
                  <select
                    value={selectedBusIndex}
                    onChange={(e) => {
                      setSelectedBusIndex(Number(e.target.value));
                      setSelectedSeatIds([]);
                    }}
                    className="bg-indigo-50 font-black text-[#001D4A] rounded-xl px-4 py-2.5 outline-none text-xs uppercase tracking-wider cursor-pointer"
                  >
                    {buses.map((bus, idx) => {
                      const matchingTour = tours.find(t => t.name === bus.busId);
                      return (
                        <option key={bus.busId} value={idx}>
                          {bus.busId} {matchingTour?.tour_type ? `(${matchingTour.tour_type})` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Tour Info Badges */}
                {tours[selectedBusIndex] && (
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg uppercase">
                      Fee: ৳{tours[selectedBusIndex].fee?.toLocaleString()}
                    </span>
                    {tours[selectedBusIndex].tour_type === 'Relax' && (
                      <span className="text-[9px] font-black text-pink-700 bg-pink-50 px-2.5 py-1 rounded-lg uppercase">
                        🏖️ Relax Tour {tours[selectedBusIndex].couple_extra_fee ? `(+৳${tours[selectedBusIndex].couple_extra_fee} Couple)` : ''}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Main Dynamic Bus Layout with Multi-Seat selection */}
              {buses.length > 0 ? (
                <div className="flex justify-center w-full">
                  <BusLayout
                    seats={buses[selectedBusIndex]?.seats || []}
                    onSeatClick={handleSeatClick}
                    selectedSeatIds={selectedSeatIds}
                    onProceedBooking={handleProceedBooking}
                    onClearSelection={() => setSelectedSeatIds([])}
                    layoutConfig={activeLayoutForSelectedBus}
                  />
                </div>
              ) : (
                <div className="text-center py-20 bg-white rounded-[40px] border border-dashed border-gray-200">
                  <p className="text-gray-400 font-black uppercase text-xs tracking-widest">No Active Routes</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'dashboard' && <Dashboard buses={buses} expenses={expenses} notify={notify} />}
          {activeTab === 'log' && <BookingLog buses={buses} bookers={bookers} isAdmin={isAdminAuthenticated} />}
          {activeTab === 'expenses' && <ExpenseTracker expenses={expenses} onSubmit={handleExpenseSubmit} onDelete={handleExpenseDelete} bookers={bookers} initialAgentCode={authenticatedAgent?.code} tours={tours} isAdmin={isAdminAuthenticated} notify={notify} />}
          {activeTab === 'revenue' && <RevenueReport buses={buses} expenses={expenses} tours={tours} isAdmin={isAdminAuthenticated} onClearExpenses={handleClearExpenses} />}
          
          {/* TAB: HOTEL & ROOM ALLOCATION (Accessible to both Agents & Admin) */}
          {activeTab === 'rooms' && (
            <div className="animate-in fade-in duration-500">
              <HotelManager
                hotels={hotels}
                rooms={rooms}
                tours={tours}
                allBookings={allBookings}
                isAdmin={isAdminAuthenticated}
                onAddHotel={handleAddHotel}
                onUpdateHotel={handleUpdateHotel}
                onDeleteHotel={handleDeleteHotel}
                onAddRoom={handleAddRoom}
                onUpdateRoom={handleUpdateRoom}
                onDeleteRoom={handleDeleteRoom}
                onAssignPassenger={handleAssignPassenger}
                onUnassignPassenger={handleUnassignPassenger}
                notify={notify}
              />
            </div>
          )}

          {activeTab === 'edit' && (
            <EditData
              buses={buses}
              onUpdate={handleSingleBookingSubmit}
              onDelete={handleBookingDelete}
              onBulkDelete={handleBulkDelete}
              onEdit={(info) => {
                setEditingInfo(info);
                setSelectedSeatIds([info.seatNo]);
                setShowBookingModal(true);
              }}
              bookers={bookers}
              isAdmin={isAdminAuthenticated}
              currentAgentCode={authenticatedAgent?.code}
            />
          )}

          {/* TAB: ADMIN CONTROL CENTER */}
          {activeTab === 'admin' && isAdminAuthenticated && (
            <AdminPanel 
              tours={tours} onUpsertTour={handleTourUpsert} onDeleteTour={handleTourDelete}
              agents={bookers} onUpsertAgent={handleAgentUpsert} onDeleteAgent={handleAgentDelete}
              customerTypes={customerTypes} onUpsertCustomerType={handleCustomerTypeUpsert} onDeleteCustomerType={handleCustomerTypeDelete}
              buses={buses}
              notices={notifications}
              onDeactivateNotice={handleNoticeDeactivate}
              notify={notify}
              busLayout={busLayout}
              onSaveBusLayout={handleSaveBusLayout}
              hotels={hotels}
              rooms={rooms}
              onAddHotel={handleAddHotel}
              onUpdateHotel={handleUpdateHotel}
              onDeleteHotel={handleDeleteHotel}
              onAddRoom={handleAddRoom}
              onUpdateRoom={handleUpdateRoom}
              onDeleteRoom={handleDeleteRoom}
              onAssignPassenger={handleAssignPassenger}
              onUnassignPassenger={handleUnassignPassenger}
            />
          )}
        </div>
      </main>

      {/* Logout Confirmation */}
      {showLogoutConfirm && (
        <ConfirmationDialog
          message="Are you sure you want to end your session?"
          onConfirm={() => {
            setAuthenticatedAgent(null);
            setIsAdminAuthenticated(false);
            setShowLogoutConfirm(false);
            localStorage.removeItem('tl_auth_agent');
            sessionStorage.removeItem('tl_auth_agent');
            localStorage.removeItem('tl_auth_admin');
            sessionStorage.removeItem('tl_auth_admin');
          }}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}

      {/* General Confirm Dialog */}
      {confirmDialog && (
        <ConfirmationDialog
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      {/* Multi-Seat & Single-Seat Booking Modal */}
      {showBookingModal && (
        <BookingModal 
          seatIds={selectedSeatIds.length > 0 ? selectedSeatIds : (editingInfo ? [editingInfo.seatNo] : [])} 
          busNo={editingInfo ? editingInfo.busNo : (buses[selectedBusIndex]?.busId || '')} 
          onClose={() => {
            if (buses[selectedBusIndex] && selectedSeatIds.length > 0) {
              releaseLocks(buses[selectedBusIndex].busId, selectedSeatIds);
            }
            setShowBookingModal(false);
            setEditingInfo(null);
            setSelectedSeatIds([]);
          }} 
          onSubmit={handleMultiBookingSubmit} 
          tours={tours} 
          bookers={bookers} 
          customerTypes={customerTypes}
          hotels={hotels}
          rooms={rooms}
          existingData={editingInfo || undefined} 
          isAdmin={isAdminAuthenticated} 
          currentAgentCode={authenticatedAgent?.code}
          notify={notify} 
        />
      )}

      {/* Seat Detail Modal */}
      {showDetailModal && editingInfo && (
        <SeatDetailModal
          info={editingInfo}
          onClose={() => { setShowDetailModal(false); setEditingInfo(null); }}
          onEdit={() => {
            setShowDetailModal(false);
            setSelectedSeatIds([editingInfo.seatNo]);
            setShowBookingModal(true);
          }}
          onCancel={() => {
            handleBookingDelete(editingInfo.busNo, editingInfo.seatNo);
            setShowDetailModal(false);
          }}
          onUpdate={handleSingleBookingSubmit}
          isAdmin={isAdminAuthenticated}
          currentAgentCode={authenticatedAgent?.code}
          notify={notify}
        />
      )}
      
      {/* Dynamic Notifications (Toast) */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] pointer-events-none"
          >
            <div className={`px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border backdrop-blur-md ${
              toast.type === 'success' ? 'bg-green-500/90 border-green-400 text-white' : 
              toast.type === 'error' ? 'bg-red-500/90 border-red-400 text-white' : 
              'bg-[#001D4A]/90 border-white/20 text-white'
            }`}>
              <i className={`fas ${toast.type === 'success' ? 'fa-check-circle' : toast.type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}`}></i>
              <span className="text-[10px] font-black uppercase tracking-widest">{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
