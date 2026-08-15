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
import { NotificationCenter } from './components/NotificationCenter';
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
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('tl_read_notification_ids') || '[]');
    } catch {
      return [];
    }
  });

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
      const allRawNotices: any[] = noticesRes.data || [];
      const fetchedNotices: any[] = allRawNotices.filter((n: any) => n.is_active !== false && !String(n.id || '').startsWith('cfg_'));

      // Sync Cloud Configurations (Bus Layouts, Hotels, Rooms, Tours Meta) across all devices
      let currentBusLayout = busLayout;
      let currentTourLayouts = busLayoutsByTour;

      // 1. Sync Tours Metadata (to guarantee Relax Tour type, couple extra fee, hotel info never reset)
      let toursMetaMap: Record<string, Partial<Tour>> = {};
      try {
        toursMetaMap = JSON.parse(localStorage.getItem('tl_tours_meta') || '{}');
      } catch (e) {}

      const toursMetaNotice = allRawNotices.find((n: any) => n.id === 'cfg_tours_meta');
      if (toursMetaNotice?.content) {
        try {
          const parsed = JSON.parse(toursMetaNotice.content);
          if (parsed && typeof parsed === 'object') {
            toursMetaMap = { ...toursMetaMap, ...parsed };
            localStorage.setItem('tl_tours_meta', toursMetaNotice.content);
          }
        } catch (e) {}
      }

      const layoutNotice = allRawNotices.find((n: any) => n.id === 'cfg_bus_layout');
      if (layoutNotice?.content) {
        try {
          const parsed = JSON.parse(layoutNotice.content);
          if (parsed && (Array.isArray(parsed.rows) || typeof parsed.rows === 'object')) {
            currentBusLayout = parsed;
            setBusLayout(parsed);
            localStorage.setItem('tl_bus_layout', layoutNotice.content);
          }
        } catch (e) {}
      }

      const tourLayoutsNotice = allRawNotices.find((n: any) => n.id === 'cfg_bus_layouts_by_tour');
      if (tourLayoutsNotice?.content) {
        try {
          const parsed = JSON.parse(tourLayoutsNotice.content);
          if (parsed && typeof parsed === 'object') {
            currentTourLayouts = parsed;
            setBusLayoutsByTour(parsed);
            localStorage.setItem('tl_bus_layouts_by_tour', tourLayoutsNotice.content);
          }
        } catch (e) {}
      }

      const hotelsNotice = allRawNotices.find((n: any) => n.id === 'cfg_hotels');
      if (hotelsNotice?.content) {
        try {
          const parsed = JSON.parse(hotelsNotice.content);
          if (Array.isArray(parsed)) {
            setHotels(parsed);
            localStorage.setItem('tl_hotels', hotelsNotice.content);
          }
        } catch (e) {}
      }

      const roomsNotice = allRawNotices.find((n: any) => n.id === 'cfg_rooms');
      if (roomsNotice?.content) {
        try {
          const parsed = JSON.parse(roomsNotice.content);
          if (Array.isArray(parsed)) {
            setRooms(parsed);
            localStorage.setItem('tl_hotel_rooms', roomsNotice.content);
          }
        } catch (e) {}
      }

      const now = new Date();
      const validLocks: SeatLock[] = fetchedLocks.filter(lock => new Date(lock.expires_at) > now);

      const onlineCutoff = new Date(Date.now() - 2 * 60 * 1000);
      const activeAgents = fetchedBookers.filter((b: any) => b.last_active && new Date(b.last_active) > onlineCutoff);
      setOnlineAgents(activeAgents);
      setNotifications(fetchedNotices);

      // Group & Room local metadata fallback
      const groupMeta: Record<string, any> = JSON.parse(localStorage.getItem('tl_booking_meta') || '{}');

      const parseSeatsList = (raw: any): string[] | undefined => {
        if (!raw) return undefined;
        if (Array.isArray(raw)) return raw;
        if (typeof raw === 'string') {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
          } catch (e) {}
          return raw.split(',').map(s => s.trim()).filter(Boolean);
        }
        return undefined;
      };

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
          groupSeatsList: parseSeatsList(b.group_seats_list) || parseSeatsList(meta.groupSeatsList),
          hotelRoomNo: b.hotel_room_no || meta.hotelRoomNo,
          hotelName: b.hotel_name || meta.hotelName
        };
      });

      // Map tours with guaranteed Relax Tour & Hotel metadata resolution
      const rawToursList = (fetchedTours && fetchedTours.length > 0 ? fetchedTours : tours);
      const mappedTours: Tour[] = rawToursList.map((t: any) => {
        const meta = toursMetaMap[t.name] || {};
        const isRelaxName = t.name.toLowerCase().includes('relax') || t.name.toLowerCase().includes('relex');
        const resolvedType = t.tour_type || meta.tour_type || (isRelaxName ? 'Relax' : 'Day Long');
        return {
          name: t.name,
          fee: Number(t.fee) || 0,
          tour_type: resolvedType,
          couple_extra_fee: t.couple_extra_fee !== undefined ? Number(t.couple_extra_fee) : (meta.couple_extra_fee !== undefined ? Number(meta.couple_extra_fee) : (resolvedType === 'Relax' ? 1000 : 0)),
          hotel_applicable: t.hotel_applicable !== undefined ? Boolean(t.hotel_applicable) : (meta.hotel_applicable !== undefined ? Boolean(meta.hotel_applicable) : (resolvedType === 'Relax')),
          hotel_name: t.hotel_name || meta.hotel_name || '',
          sort_order: t.sort_order !== undefined ? Number(t.sort_order) : (meta.sort_order !== undefined ? Number(meta.sort_order) : 0)
        };
      }).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

      setTours(mappedTours);
      setBookers(fetchedBookers);
      setCustomerTypes(fetchedTypes);
      setExpenses((expensesRes.data || []).map((ex: any) => ({
        id: ex.id, category: ex.category, amount: ex.amount, description: ex.description,
        date: ex.date, recordedBy: ex.recorded_by, agentCode: ex.agent_code, tourName: ex.tour_name
      })));

      const busLayouts = fetchedTours.map(t => {
        const layoutToUse = currentTourLayouts[t.name] || currentBusLayout;
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

  // Handle seat clicks on Bus Layout (Real-time 5-minute seat locking for agents)
  const handleSeatClick = async (sid: string) => {
    const currentBus = buses[selectedBusIndex];
    if (!currentBus) return;
    const seat = currentBus.seats.find(s => s.id === sid);

    // If already booked, open details modal
    if (seat?.isBooked && seat.bookingInfo) {
      setEditingInfo(seat.bookingInfo);
      setShowDetailModal(true);
      return;
    }

    // If temporarily locked by another agent (5 min hold)
    if (seat?.lockInfo && seat.lockInfo.agent_code !== (authenticatedAgent?.code || 'GUEST')) {
      notify(`⚠️ আসন ${sid} এজেন্ট ${seat.lockInfo.agent_name || 'অন্য এজেন্ট'} দ্বারা ৫ মিনিটের জন্য রিজার্ভড (Locked)`, 'error');
      return;
    }

    // Toggle multi-seat selection & live 5-minute lock
    const isCurrentlySelected = selectedSeatIds.includes(sid);
    if (isCurrentlySelected) {
      // Deselect and release seat lock
      setSelectedSeatIds(prev => prev.filter(id => id !== sid));
      try {
        await supabase.from('tl_locks')
          .delete()
          .eq('bus_no', currentBus.busId)
          .eq('seat_no', sid);
      } catch (e) {
        console.error("Lock release error:", e);
      }
    } else {
      // Select and acquire 5-minute lock
      const newSelected = [...selectedSeatIds, sid];
      setSelectedSeatIds(newSelected);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      try {
        await supabase.from('tl_locks').upsert({
          bus_no: currentBus.busId,
          seat_no: sid,
          agent_code: authenticatedAgent?.code || 'GUEST',
          agent_name: authenticatedAgent?.name || (isAdminAuthenticated ? 'Admin' : 'Agent'),
          expires_at: expiresAt
        });
      } catch (e) {
        console.error("Lock acquire error:", e);
      }
    }
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
      // Refresh locks for selected seats
      const lockInserts = seatsToBook.map(sId => ({
        bus_no: currentBus.busId,
        seat_no: sId,
        agent_code: authenticatedAgent?.code || 'GUEST',
        agent_name: authenticatedAgent?.name || (isAdminAuthenticated ? 'Admin' : 'Agent'),
        expires_at: expiresAt
      }));

      await supabase.from('tl_locks').upsert(lockInserts);
    } catch (e) {}
    
    setSelectedSeatIds(seatsToBook);
    setShowBookingModal(true);
  };

  const releaseLocks = async (busNo: string, seatIds: string[]) => {
    if (seatIds.length === 0) return;
    try {
      await supabase.from('tl_locks')
        .delete()
        .eq('bus_no', busNo)
        .in('seat_no', seatIds);
    } catch (e) {
      console.error("Release lock error:", e);
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

      // Broadcast notification to all agents for new/updated booking
      try {
        const leadName = bookings[0]?.name || 'Passenger';
        const busName = bookings[0]?.tourName || bookings[0]?.busNo || 'Tour';
        const totalSeats = bookings.length;
        const agentName = bookings[0]?.bookedBy || 'Agent';
        const seatStr = bookings.map(b => b.seatNo).join(', ');

        await supabase.from('tl_notices').insert({
          content: `📢 [নতুন বুকিং] ${agentName} বুক করেছেন ${leadName}-এর ${totalSeats}টি সিট (${seatStr}) [${busName}]`,
          type: 'success',
          is_active: true
        });
      } catch (err) {
        console.warn("Notice broadcast error:", err);
      }
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

      // Broadcast notification to all agents for deleted booking
      try {
        await supabase.from('tl_notices').insert({
          content: `🗑️ [বুকিং বাতিল] এডমিন সিট ${seatId} (${busId}) বুকিং বাতিল করেছেন। সিটটি এখন খালি।`,
          type: 'error',
          is_active: true
        });
      } catch (err) {
        console.warn("Notice broadcast error:", err);
      }
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

      // Broadcast notification to all agents for bulk deleted booking
      try {
        await supabase.from('tl_notices').insert({
          content: `🗑️ [বুকিং রিমুভ] এডমিন ${ids.length}টি সিটের বুকিং ডাটা মুছে ফেলেছেন।`,
          type: 'error',
          is_active: true
        });
      } catch (err) {
        console.warn("Notice broadcast error:", err);
      }
    } catch (error) {
      notify("Bulk delete failed.", 'error');
    }
  };

  // Bus Layout Customizer Handler with Cloud Sync
  const handleSaveBusLayout = async (layout: BusCustomLayout, applyToTour?: string) => {
    try {
      if (applyToTour) {
        const updatedTourLayouts = { ...busLayoutsByTour, [applyToTour]: layout };
        setBusLayoutsByTour(updatedTourLayouts);
        localStorage.setItem('tl_bus_layouts_by_tour', JSON.stringify(updatedTourLayouts));
        await supabase.from('tl_notices').upsert({
          id: 'cfg_bus_layouts_by_tour',
          title: 'Config Tour Layouts',
          content: JSON.stringify(updatedTourLayouts),
          is_active: false
        });
      } else {
        setBusLayout(layout);
        localStorage.setItem('tl_bus_layout', JSON.stringify(layout));
        await supabase.from('tl_notices').upsert({
          id: 'cfg_bus_layout',
          title: 'Config Bus Layout',
          content: JSON.stringify(layout),
          is_active: false
        });
      }
    } catch (e) {
      console.error("Layout sync error:", e);
    }
    fetchData();
  };

  // Hotel & Room Management Handlers with Cloud Sync
  const handleAddHotel = async (hotel: Hotel) => {
    if (!isAdminAuthenticated) {
      notify("Only admin can create hotels.", 'error');
      return;
    }
    const updated = [...hotels, hotel];
    setHotels(updated);
    localStorage.setItem('tl_hotels', JSON.stringify(updated));
    try {
      await supabase.from('tl_notices').upsert({
        id: 'cfg_hotels',
        title: 'Config Hotels',
        content: JSON.stringify(updated),
        is_active: false
      });
    } catch (e) {}
  };

  const handleUpdateHotel = async (hotel: Hotel) => {
    if (!isAdminAuthenticated) {
      notify("Only admin can update hotels.", 'error');
      return;
    }
    const updated = hotels.map(h => h.id === hotel.id ? hotel : h);
    setHotels(updated);
    localStorage.setItem('tl_hotels', JSON.stringify(updated));
    try {
      await supabase.from('tl_notices').upsert({
        id: 'cfg_hotels',
        title: 'Config Hotels',
        content: JSON.stringify(updated),
        is_active: false
      });
    } catch (e) {}
  };

  const handleDeleteHotel = async (hotelId: string) => {
    if (!isAdminAuthenticated) {
      notify("Only admin can delete hotels.", 'error');
      return;
    }
    const updated = hotels.filter(h => h.id !== hotelId);
    setHotels(updated);
    localStorage.setItem('tl_hotels', JSON.stringify(updated));
    try {
      await supabase.from('tl_notices').upsert({
        id: 'cfg_hotels',
        title: 'Config Hotels',
        content: JSON.stringify(updated),
        is_active: false
      });
    } catch (e) {}
  };

  const handleAddRoom = async (room: HotelRoom) => {
    if (!isAdminAuthenticated) {
      notify("Only admin can create rooms.", 'error');
      return;
    }
    const updated = [...rooms, room];
    setRooms(updated);
    localStorage.setItem('tl_hotel_rooms', JSON.stringify(updated));
    try {
      await supabase.from('tl_notices').upsert({
        id: 'cfg_rooms',
        title: 'Config Rooms',
        content: JSON.stringify(updated),
        is_active: false
      });
    } catch (e) {}
  };

  const handleUpdateRoom = async (room: HotelRoom) => {
    if (!isAdminAuthenticated) {
      notify("Only admin can update rooms.", 'error');
      return;
    }
    const updated = rooms.map(r => r.id === room.id ? room : r);
    setRooms(updated);
    localStorage.setItem('tl_hotel_rooms', JSON.stringify(updated));
    try {
      await supabase.from('tl_notices').upsert({
        id: 'cfg_rooms',
        title: 'Config Rooms',
        content: JSON.stringify(updated),
        is_active: false
      });
    } catch (e) {}
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!isAdminAuthenticated) {
      notify("Only admin can delete rooms.", 'error');
      return;
    }
    const updated = rooms.filter(r => r.id !== roomId);
    setRooms(updated);
    localStorage.setItem('tl_hotel_rooms', JSON.stringify(updated));
    try {
      await supabase.from('tl_notices').upsert({
        id: 'cfg_rooms',
        title: 'Config Rooms',
        content: JSON.stringify(updated),
        is_active: false
      });
    } catch (e) {}
  };

  const handleAssignPassenger = async (roomId: string, bookingId: string) => {
    const targetRoom = rooms.find(r => r.id === roomId);
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
    
    // Also sync hotel room details into booking metadata & Supabase
    if (targetRoom) {
      try {
        const meta = JSON.parse(localStorage.getItem('tl_booking_meta') || '{}');
        meta[bookingId] = { ...(meta[bookingId] || {}), hotelRoomNo: targetRoom.roomNo, hotelName: targetRoom.hotelName };
        localStorage.setItem('tl_booking_meta', JSON.stringify(meta));
        
        await supabase.from('tl_bookings').update({
          hotel_room_no: targetRoom.roomNo,
          hotel_name: targetRoom.hotelName
        }).eq('id', bookingId);
      } catch (e) {}
    }

    try {
      await supabase.from('tl_notices').upsert({
        id: 'cfg_rooms',
        title: 'Config Rooms',
        content: JSON.stringify(updatedRooms),
        is_active: false
      });
    } catch (e) {}
    notify("Passenger assigned to room!", 'success');
  };

  const handleUnassignPassenger = async (roomId: string, bookingId: string) => {
    const updatedRooms = rooms.map(r => {
      if (r.id === roomId) {
        return { ...r, assignedBookingIds: (r.assignedBookingIds || []).filter(id => id !== bookingId) };
      }
      return r;
    });
    setRooms(updatedRooms);
    localStorage.setItem('tl_hotel_rooms', JSON.stringify(updatedRooms));

    try {
      const meta = JSON.parse(localStorage.getItem('tl_booking_meta') || '{}');
      if (meta[bookingId]) {
        meta[bookingId].hotelRoomNo = null;
        meta[bookingId].hotelName = null;
        localStorage.setItem('tl_booking_meta', JSON.stringify(meta));
      }
      await supabase.from('tl_bookings').update({
        hotel_room_no: null,
        hotel_name: null
      }).eq('id', bookingId);
    } catch (e) {}

    try {
      await supabase.from('tl_notices').upsert({
        id: 'cfg_rooms',
        title: 'Config Rooms',
        content: JSON.stringify(updatedRooms),
        is_active: false
      });
    } catch (e) {}
    notify("Passenger removed from room.", 'info');
  };

  // Notification Management Handlers (Mark Read, Clear, Batch)
  const handleMarkNoticeAsRead = (id: string) => {
    const idStr = String(id);
    if (!readNotificationIds.includes(idStr)) {
      const updated = [...readNotificationIds, idStr];
      setReadNotificationIds(updated);
      localStorage.setItem('tl_read_notification_ids', JSON.stringify(updated));
    }
  };

  const handleMarkAllNoticesAsRead = () => {
    const allIds = notifications.map(n => String(n.id));
    const merged = Array.from(new Set([...readNotificationIds, ...allIds]));
    setReadNotificationIds(merged);
    localStorage.setItem('tl_read_notification_ids', JSON.stringify(merged));
    notify("সব নোটিফিকেশন পড়া হয়েছে (Marked as read)!", 'success');
  };

  const handleClearNotice = async (id: string) => {
    const idStr = String(id);
    // Optimistic UI update
    setNotifications(prev => prev.filter(n => String(n.id) !== idStr));
    
    // Also remove from read set if present
    const updatedRead = readNotificationIds.filter(rId => rId !== idStr);
    setReadNotificationIds(updatedRead);
    localStorage.setItem('tl_read_notification_ids', JSON.stringify(updatedRead));

    try {
      await supabase.from('tl_notices').delete().eq('id', id);
    } catch (e) {
      console.warn("Failed to delete notice from database:", e);
    }
  };

  const handleClearAllNotices = async () => {
    if (notifications.length === 0) return;
    
    const noticeIds = notifications.map(n => n.id);
    setNotifications([]);
    setReadNotificationIds([]);
    localStorage.removeItem('tl_read_notification_ids');

    try {
      await supabase.from('tl_notices').delete().in('id', noticeIds);
      notify("সকল নোটিফিকেশন ক্লিয়ার করা হয়েছে!", 'info');
    } catch (e) {
      console.warn("Failed to batch delete notices:", e);
    }
  };

  // Admin Master Data Handlers - Robust Relax Tour & Hotel Persistence
  const handleTourUpsert = async (tour: Tour) => {
    try {
      const isRelax = tour.tour_type === 'Relax' || 
                      tour.name.toLowerCase().includes('relax') || 
                      tour.name.toLowerCase().includes('relex');
      
      const resolvedTourType = isRelax ? 'Relax' : (tour.tour_type || 'Day Long');
      const resolvedCoupleFee = tour.couple_extra_fee !== undefined ? Number(tour.couple_extra_fee) : (isRelax ? 1000 : 0);
      const resolvedHotelName = tour.hotel_name?.trim() || (isRelax ? `${tour.name} Resort/Hotel` : '');
      
      const finalTour: Tour = {
        name: tour.name.trim(),
        fee: Number(tour.fee) || 0,
        tour_type: resolvedTourType,
        couple_extra_fee: resolvedCoupleFee,
        hotel_applicable: isRelax,
        hotel_name: resolvedHotelName,
        sort_order: tour.sort_order || 0
      };

      // 1. Update local and cloud metadata config notice (ensures Relax Tour never resets)
      let currentMeta: Record<string, any> = {};
      try {
        currentMeta = JSON.parse(localStorage.getItem('tl_tours_meta') || '{}');
      } catch (e) {}
      const updatedMeta = { ...currentMeta, [finalTour.name]: finalTour };
      localStorage.setItem('tl_tours_meta', JSON.stringify(updatedMeta));

      // Optimistically update React State
      setTours(prev => {
        const exists = prev.some(t => t.name === finalTour.name);
        if (exists) {
          return prev.map(t => t.name === finalTour.name ? finalTour : t).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
        } else {
          return [...prev, finalTour].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
        }
      });

      // 2. If it's a Relax Tour, ensure a Hotel & Starter Rooms exist for this tour in HotelManager
      if (isRelax) {
        setHotels(prevHotels => {
          const hotelExists = prevHotels.some(h => h.tourName === finalTour.name || (resolvedHotelName && h.name === resolvedHotelName));
          if (!hotelExists) {
            const newHotelObj: Hotel = {
              id: `htl_${Date.now()}`,
              name: resolvedHotelName || `${finalTour.name} Luxury Resort`,
              location: finalTour.name,
              tourName: finalTour.name,
              contactNumber: '01800000000',
              address: `${finalTour.name} Premium Hotel & Resort Accommodation`
            };
            const updatedHotels = [...prevHotels, newHotelObj];
            localStorage.setItem('tl_hotels', JSON.stringify(updatedHotels));
            supabase.from('tl_notices').upsert({
              id: 'cfg_hotels',
              title: 'Config Hotels',
              content: JSON.stringify(updatedHotels),
              is_active: false
            }).then(() => {});

            // Auto-create starter rooms for this hotel
            setRooms(prevRooms => {
              const roomsExist = prevRooms.some(r => r.tourName === finalTour.name);
              if (!roomsExist) {
                const starterRooms: HotelRoom[] = [
                  { id: `rm_${Date.now()}_101`, hotelId: newHotelObj.id, hotelName: newHotelObj.name, tourName: finalTour.name, roomNo: '101', roomType: 'Couple', capacity: 2, floor: '1st Floor', assignedBookingIds: [] },
                  { id: `rm_${Date.now()}_102`, hotelId: newHotelObj.id, hotelName: newHotelObj.name, tourName: finalTour.name, roomNo: '102', roomType: 'Couple', capacity: 2, floor: '1st Floor', assignedBookingIds: [] },
                  { id: `rm_${Date.now()}_103`, hotelId: newHotelObj.id, hotelName: newHotelObj.name, tourName: finalTour.name, roomNo: '103', roomType: 'Combine4', capacity: 4, floor: '1st Floor', assignedBookingIds: [] },
                  { id: `rm_${Date.now()}_201`, hotelId: newHotelObj.id, hotelName: newHotelObj.name, tourName: finalTour.name, roomNo: '201', roomType: 'Combine5', capacity: 5, floor: '2nd Floor', assignedBookingIds: [] },
                  { id: `rm_${Date.now()}_202`, hotelId: newHotelObj.id, hotelName: newHotelObj.name, tourName: finalTour.name, roomNo: '202', roomType: 'Single', capacity: 1, floor: '2nd Floor', assignedBookingIds: [] }
                ];
                const updatedRooms = [...prevRooms, ...starterRooms];
                localStorage.setItem('tl_hotel_rooms', JSON.stringify(updatedRooms));
                supabase.from('tl_notices').upsert({
                  id: 'cfg_rooms',
                  title: 'Config Rooms',
                  content: JSON.stringify(updatedRooms),
                  is_active: false
                }).then(() => {});
                return updatedRooms;
              }
              return prevRooms;
            });

            return updatedHotels;
          }
          return prevHotels;
        });
      }

      // 3. Upsert Cloud Config Notice as infallible fallback
      try {
        await supabase.from('tl_notices').upsert({
          id: 'cfg_tours_meta',
          title: 'Config Tours Meta',
          content: JSON.stringify(updatedMeta),
          is_active: false
        });
      } catch (err) {}

      // 4. Upsert to Supabase tl_tours with multi-level schema fallback
      const fullPayload: any = { 
        name: finalTour.name, 
        fee: finalTour.fee,
        tour_type: finalTour.tour_type,
        couple_extra_fee: finalTour.couple_extra_fee,
        hotel_name: finalTour.hotel_name || null,
        hotel_applicable: finalTour.hotel_applicable,
        sort_order: finalTour.sort_order || 0
      };
      
      let { error } = await supabase.from('tl_tours').upsert(fullPayload, { onConflict: 'name' });
      
      if (error) {
        console.warn("Retrying tour upsert with reduced payload:", error.message);
        // Fallback 1: Without hotel_applicable or sort_order
        const payload2 = {
          name: finalTour.name,
          fee: finalTour.fee,
          tour_type: finalTour.tour_type,
          couple_extra_fee: finalTour.couple_extra_fee,
          hotel_name: finalTour.hotel_name || null
        };
        const retry1 = await supabase.from('tl_tours').upsert(payload2, { onConflict: 'name' });
        error = retry1.error;

        // Fallback 2: Basic name and fee only
        if (error) {
          const payloadBasic = { 
            name: finalTour.name, 
            fee: finalTour.fee 
          };
          const retry2 = await supabase.from('tl_tours').upsert(payloadBasic, { onConflict: 'name' });
          error = retry2.error;
        }
      }

      if (error) {
        console.error("Supabase tl_tours error:", error);
        if (error.code === '42501' || error.message?.includes('row-level security') || error.message?.includes('RLS')) {
          notify(`ট্যুর "${finalTour.name}" অ্যাপে যুক্ত হয়েছে! তবে Supabase RLS অন থাকায় Admin Panel > Database Schema থেকে SQL টি রান করে RLS বন্ধ করুন।`, 'info');
        } else {
          notify(`ট্যুর রুট "${finalTour.name}" সেভ হয়েছে!`, 'success');
        }
      } else {
        notify(`ট্যুর রুট "${finalTour.name}" (${finalTour.tour_type === 'Relax' ? 'রিল্যাক্স ট্যুর 🏨' : 'ডে লং'}) সফলভাবে সংরক্ষিত হয়েছে!`, 'success');
      }

      await fetchData();
    } catch (e: any) { 
      console.error("Tour upsert fatal error:", e);
      notify("ট্যুর সেভ করতে সমস্যা হয়েছে: " + (e?.message || "Check connection"), 'error'); 
    }
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
      const fullPayload = { 
        code: agent.code, 
        name: agent.name,
        phone: agent.phone || agent.mobile || null,
        mobile: agent.mobile || agent.phone || null
      };
      let { error } = await supabase.from('tl_agents').upsert(fullPayload, { onConflict: 'code' });
      if (error && (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('schema cache'))) {
        const basePayload = { code: agent.code, name: agent.name };
        const retry = await supabase.from('tl_agents').upsert(basePayload, { onConflict: 'code' });
        error = retry.error;
      }
      if (error) throw error;
      fetchData();
      notify("Agent saved successfully with phone!", 'success');
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
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row max-w-full overflow-x-hidden">
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[68px] sm:h-[75px] bg-[#001D4A]/95 backdrop-blur-md flex items-center justify-around z-[100] border-t border-white/10 shadow-[0_-10px_30px_rgba(0,0,0,0.3)] px-1 pb-safe max-w-full">
        {navItems.map(item => (
          <button key={item.id} onClick={() => setActiveTab(item.id as any)} className={`flex-1 flex flex-col items-center justify-center gap-0.5 sm:gap-1 transition-all py-1.5 sm:py-2 rounded-xl sm:rounded-2xl mx-0.5 ${activeTab === item.id ? 'bg-orange-500 text-white shadow-lg' : 'text-white/30'}`}>
            <i className={`fas ${item.icon} text-base sm:text-lg`}></i>
            <span className="text-[7px] font-black uppercase tracking-tight">{item.label}</span>
          </button>
        ))}
        {isAdminAuthenticated && (
          <button onClick={() => setActiveTab('admin')} className={`flex-1 flex flex-col items-center justify-center gap-0.5 sm:gap-1 transition-all py-1.5 sm:py-2 rounded-xl sm:rounded-2xl mx-0.5 ${activeTab === 'admin' ? 'bg-orange-500 text-white shadow-lg' : 'text-white/30'}`}>
            <i className="fas fa-user-shield text-base sm:text-lg"></i>
            <span className="text-[7px] font-black uppercase tracking-tight">Admin</span>
          </button>
        )}
      </nav>

      <main className="flex-grow md:ml-24 p-3 sm:p-5 md:p-10 pb-24 md:pb-10 min-w-0 max-w-full overflow-x-hidden">
        <header className="flex justify-between items-center mb-4 sm:mb-6 md:mb-8 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="md:hidden w-9 h-9 sm:w-10 sm:h-10 bg-white p-1.5 sm:p-2 rounded-xl shadow-sm shrink-0"><img src={BUSINESS_INFO.logo} className="w-full h-full object-contain" /></div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg sm:text-2xl md:text-3xl font-black text-[#001D4A] uppercase tracking-tighter leading-tight truncate">
                {activeTab === 'booking' ? 'Seat Plan & Booking' : activeTab === 'rooms' ? 'Hotel & Room Allocation' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
              </h2>
              <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shrink-0"></div>
                <p className="text-[8px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest truncate">
                  Online: {onlineAgents.map(a => a.name).join(', ') || 'No active agents'}
                </p>
              </div>
            </div>
          </div>
          
          {/* Header Right Actions: Notification Bell Center & Logout */}
          <div className="flex items-center gap-3">
            <NotificationCenter
              notifications={notifications}
              readIds={readNotificationIds}
              onMarkAsRead={handleMarkNoticeAsRead}
              onMarkAllAsRead={handleMarkAllNoticesAsRead}
              onClearNotification={handleClearNotice}
              onClearAllNotifications={handleClearAllNotices}
            />

            <button 
              onClick={() => setShowLogoutConfirm(true)} 
              className="w-11 h-11 md:w-12 md:h-12 rounded-2xl bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition-all border border-red-100 shadow-sm"
              title="লগআউট"
            >
              <i className="fas fa-power-off text-base md:text-lg"></i>
            </button>
          </div>
        </header>

        <div className="max-w-7xl mx-auto">
          {/* Notice Board - Only displays active unread broadcast notices. Disappears when marked as Read */}
          {(() => {
            const activeUnreadNotices = notifications.filter(n => !readNotificationIds.includes(String(n.id)));
            if (activeUnreadNotices.length === 0) return null;
            const topNotice = activeUnreadNotices[0];

            return (
              <div className="mb-6 overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.div 
                    key={topNotice.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    transition={{ duration: 0.25 }}
                    className={`p-4 md:p-5 rounded-[28px] border border-white/20 flex items-center justify-between gap-4 relative overflow-hidden backdrop-blur-md shadow-lg ${
                      topNotice.type === 'error' ? 'bg-red-500 text-white' : 
                      topNotice.type === 'success' ? 'bg-emerald-600 text-white' : 
                      'bg-[#001D4A] text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                        <i className="fas fa-bullhorn text-xs animate-bounce text-orange-300"></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[8px] md:text-[9px] font-black uppercase tracking-widest opacity-75">
                            Live Alert Broadcast
                          </p>
                          <span className="bg-orange-400 text-white text-[8px] font-black px-1.5 py-0.2 rounded uppercase animate-pulse">
                            New
                          </span>
                        </div>
                        <p className="text-xs md:text-sm font-bold tracking-tight truncate">{topNotice.content}</p>
                      </div>
                    </div>

                    {/* Banner Quick Actions: Read (Disappears from banner) & Clear */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleMarkNoticeAsRead(String(topNotice.id))}
                        className="px-3 py-1.5 bg-white/20 hover:bg-white/30 active:scale-95 text-white rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1.5 shadow-sm"
                        title="পড়া হয়েছে (ব্যানার থেকে হাইড হবে, বেল আইকনের All-এ থাকবে)"
                      >
                        <i className="fas fa-check"></i>
                        <span>Read</span>
                      </button>
                      <button
                        onClick={() => handleClearNotice(String(topNotice.id))}
                        className="w-8 h-8 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-xl flex items-center justify-center text-xs transition-all"
                        title="নোটিফিকেশন ডিলিট করুন"
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            );
          })()}

          {/* TAB 1: SEAT PLAN & MULTI-SEAT BOOKING */}
          {activeTab === 'booking' && (
            <div className="animate-in fade-in duration-500 space-y-6">
              {/* Tour / Route Selector Bar */}
              <div className="bg-white p-3 sm:p-4 rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 sticky top-0 z-40 max-w-full overflow-hidden">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest shrink-0">Route:</span>
                  <select
                    value={selectedBusIndex}
                    onChange={(e) => {
                      setSelectedBusIndex(Number(e.target.value));
                      setSelectedSeatIds([]);
                    }}
                    className="bg-indigo-50 font-black text-[#001D4A] rounded-xl px-3 py-2 sm:px-4 sm:py-2.5 outline-none text-xs uppercase tracking-wider cursor-pointer w-full min-w-0 max-w-full truncate"
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
                  <div className="flex items-center flex-wrap gap-1.5 sm:gap-2 shrink-0">
                    <span className="text-[9px] font-black text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg uppercase">
                      Fee: ৳{(tours[selectedBusIndex].fee ?? 0).toLocaleString()}
                    </span>
                    {tours[selectedBusIndex].tour_type === 'Relax' && (
                      <span className="text-[9px] font-black text-pink-700 bg-pink-50 px-2.5 py-1 rounded-lg uppercase">
                        🏖️ Relax Tour {tours[selectedBusIndex].couple_extra_fee ? `(+৳${(tours[selectedBusIndex].couple_extra_fee ?? 0).toLocaleString()} Couple)` : ''}
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
                    onClearSelection={() => {
                      if (buses[selectedBusIndex] && selectedSeatIds.length > 0) {
                        releaseLocks(buses[selectedBusIndex].busId, selectedSeatIds);
                      }
                      setSelectedSeatIds([]);
                    }}
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
              onMultiUpdate={handleMultiBookingSubmit}
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
              notify={notify}
              requestConfirm={(msg, action) => setConfirmDialog({ message: msg, onConfirm: () => { action(); setConfirmDialog(null); } })}
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
              busLayoutsByTour={busLayoutsByTour}
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
          allBookings={allBookings}
          bookers={bookers}
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
