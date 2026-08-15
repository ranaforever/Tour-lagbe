import React, { useState, useMemo } from 'react';
import { Tour, Booker, CustomerType, BusData, BookingInfo, BusCustomLayout, Hotel, HotelRoom } from '../types';
import { BUSINESS_INFO } from '../constants';
import { supabase } from '../supabase';
import BusLayoutEditor from './BusLayoutEditor';
import HotelManager from './HotelManager';

interface AdminPanelProps {
  tours: Tour[];
  onUpsertTour: (tour: Tour) => Promise<void>;
  onDeleteTour: (name: string) => Promise<void>;
  agents: Booker[];
  onUpsertAgent: (agent: Booker) => Promise<void>;
  onDeleteAgent: (code: string) => Promise<void>;
  customerTypes: CustomerType[];
  onUpsertCustomerType: (type: CustomerType) => Promise<void>;
  onDeleteCustomerType: (type: string) => Promise<void>;
  buses: BusData[];
  notices?: any[];
  onDeactivateNotice?: (id: string) => Promise<void>;
  notify?: (msg: string, type: 'success' | 'error' | 'info') => void;
  // Layout & Hotel Props
  busLayout: BusCustomLayout;
  onSaveBusLayout: (layout: BusCustomLayout, applyToTour?: string) => void;
  hotels: Hotel[];
  rooms: HotelRoom[];
  onAddHotel: (hotel: Hotel) => void;
  onUpdateHotel?: (hotel: Hotel) => void;
  onDeleteHotel: (hotelId: string) => void;
  onAddRoom: (room: HotelRoom) => void;
  onUpdateRoom?: (room: HotelRoom) => void;
  onDeleteRoom: (roomId: string) => void;
  onAssignPassenger: (roomId: string, bookingId: string) => void;
  onUnassignPassenger: (roomId: string, bookingId: string) => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ 
  tours, onUpsertTour, onDeleteTour,
  agents, onUpsertAgent, onDeleteAgent,
  customerTypes, onUpsertCustomerType, onDeleteCustomerType,
  buses, notices = [], onDeactivateNotice, notify,
  busLayout, onSaveBusLayout,
  hotels, rooms, onAddHotel, onUpdateHotel, onDeleteHotel, onAddRoom, onUpdateRoom, onDeleteRoom, onAssignPassenger, onUnassignPassenger
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'tours' | 'agents' | 'types' | 'layout' | 'hotel' | 'print' | 'food' | 'notices' | 'database'>('tours');
  const [copiedSql, setCopiedSql] = useState(false);
  
  const [newTour, setNewTour] = useState<{
    name: string;
    fee: number;
    tour_type: 'Day Long' | 'Relax';
    couple_extra_fee: number;
    hotel_name: string;
  }>({
    name: '',
    fee: 0,
    tour_type: 'Day Long',
    couple_extra_fee: 1000,
    hotel_name: ''
  });

  const [newAgent, setNewAgent] = useState<{ code: string; name: string; phone: string }>({ code: '', name: '', phone: '' });
  const [newType, setNewType] = useState({ type: '', fee: 0, tour_name: undefined as string | undefined });

  const [editTourIndex, setEditTourIndex] = useState<number | null>(null);
  const [editTourData, setEditTourData] = useState<Tour | null>(null);

  const [editAgentIndex, setEditAgentIndex] = useState<number | null>(null);
  const [editAgentData, setEditAgentData] = useState<Booker | null>(null);

  const [editTypeIndex, setEditTypeIndex] = useState<number | null>(null);
  const [editTypeData, setEditTypeData] = useState<CustomerType | null>(null);

  const [selectedForPrint, setSelectedForPrint] = useState<string[]>([]);
  
  const [foodType, setFoodType] = useState<'Breakfast' | 'Lunch' | 'Dinner' | 'Special Item' | 'Snacks' | 'Refreshment'>('Breakfast');
  const [foodTime, setFoodTime] = useState('08:30 AM');
  const [foodMenu, setFoodMenu] = useState('Standard Set Menu');
  const [foodFilterTour, setFoodFilterTour] = useState('');
  const [foodFilterBooker, setFoodFilterBooker] = useState('');

  const [printFilterTour, setPrintFilterTour] = useState('');
  const [printFilterBooker, setPrintFilterBooker] = useState('');

  const allBookings: BookingInfo[] = useMemo(() => 
    buses.flatMap(b => b.seats.filter(s => s.isBooked).map(s => s.bookingInfo!)),
    [buses]
  );

  // Group combined bookings for 1-ticket-per-group printing
  interface GroupedTicket {
    id: string; // group lead id
    leadBooking: BookingInfo;
    seatsList: string[];
    totalSeats: number;
    totalAdvance: number;
    totalDue: number;
    totalFees: number;
    agentName: string;
    agentCode: string;
    agentPhone: string;
  }

  const groupedTickets = useMemo(() => {
    const map = new Map<string, BookingInfo[]>();

    allBookings.forEach(b => {
      const gId = b.primaryBookingId || (b.totalGroupSeats && b.totalGroupSeats > 1 ? b.id : b.id);
      if (!map.has(gId)) {
        map.set(gId, []);
      }
      map.get(gId)!.push(b);
    });

    const list: GroupedTicket[] = [];
    map.forEach((bookings, gId) => {
      const lead = bookings.find(b => b.isPrimary || b.id === gId) || bookings[0];
      const seats = Array.from(new Set(bookings.map(b => b.seatNo))).sort();
      const adv = bookings.reduce((sum, b) => sum + (b.advanceAmount || 0), 0);
      const due = bookings.reduce((sum, b) => sum + (b.dueAmount || 0), 0);
      const fees = bookings.reduce((sum, b) => sum + (b.tourFees + (b.customerTypeFees || 0)), 0);
      const ag = agents.find(a => a.code.toUpperCase() === lead.bookerCode.toUpperCase() || a.name.toLowerCase() === lead.bookedBy.toLowerCase());

      list.push({
        id: gId,
        leadBooking: lead,
        seatsList: seats,
        totalSeats: lead.totalGroupSeats || seats.length,
        totalAdvance: adv,
        totalDue: due,
        totalFees: fees,
        agentName: lead.bookedBy || 'Admin',
        agentCode: lead.bookerCode || '',
        agentPhone: ag?.mobile || ag?.phone || ''
      });
    });

    return list;
  }, [allBookings, agents]);

  const filteredPrintBookings = useMemo(() => {
    return groupedTickets.filter(g => {
      const matchTour = printFilterTour === '' || g.leadBooking.tourName === printFilterTour;
      const matchBooker = printFilterBooker === '' || g.leadBooking.bookerCode === printFilterBooker;
      return matchTour && matchBooker;
    });
  }, [groupedTickets, printFilterTour, printFilterBooker]);

  const filteredFoodBookings = useMemo(() => {
    return allBookings.filter(b => {
      const matchTour = foodFilterTour === '' || b.tourName === foodFilterTour;
      const matchBooker = foodFilterBooker === '' || b.bookerCode === foodFilterBooker;
      return matchTour && matchBooker;
    });
  }, [allBookings, foodFilterTour, foodFilterBooker]);

  const addTour = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTour.name.trim()) return;
    const maxOrder = tours.reduce((max, t) => Math.max(max, t.sort_order || 0), 0);
    await onUpsertTour({ 
      name: newTour.name.trim(), 
      fee: newTour.fee,
      tour_type: newTour.tour_type,
      couple_extra_fee: newTour.couple_extra_fee,
      hotel_name: newTour.hotel_name.trim() || undefined,
      sort_order: maxOrder + 1
    });
    setNewTour({ name: '', fee: 0, tour_type: 'Day Long', couple_extra_fee: 1000, hotel_name: '' });
    notify?.("Tour added successfully!", 'success');
  };

  const saveTourEdit = async () => {
    if (editTourData) {
      await onUpsertTour(editTourData);
      setEditTourIndex(null);
      notify?.("Tour updated successfully!", 'success');
    }
  };

  const addAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgent.code.trim() || !newAgent.name.trim()) return;
    await onUpsertAgent({
      code: newAgent.code.trim().toUpperCase(),
      name: newAgent.name.trim(),
      phone: newAgent.phone.trim(),
      mobile: newAgent.phone.trim()
    });
    setNewAgent({ code: '', name: '', phone: '' });
    notify?.("Agent registered with phone number!", 'success');
  };

  const saveAgentEdit = async () => {
    if (editAgentData) {
      await onUpsertAgent(editAgentData);
      setEditAgentIndex(null);
      notify?.("Agent updated!", 'success');
    }
  };

  const addType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newType.type.trim()) return;
    const maxOrder = customerTypes.reduce((max, t) => Math.max(max, t.sort_order || 0), 0);
    await onUpsertCustomerType({ 
      type: newType.type.trim(), 
      fee: newType.fee,
      sort_order: maxOrder + 1
    });
    setNewType({ type: '', fee: 0 });
    notify?.("Pricing category saved!", 'success');
  };

  const saveTypeEdit = async () => {
    if (editTypeData) {
      await onUpsertCustomerType(editTypeData);
      setEditTypeIndex(null);
      notify?.("Pricing category updated!", 'success');
    }
  };

  /**
   * Print 6 Tickets per A4 Sheet (2 Columns x 3 Rows)
   * A4 dimensions: 210mm x 297mm
   * Each ticket: 105mm x 99mm
   * For combined bookings: Generates 1 single consolidated ticket with all seats and primary booker name!
   */
  const handlePrintBatch = () => {
    if (selectedForPrint.length === 0) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const ticketsToPrint = groupedTickets.filter(g => selectedForPrint.includes(g.id));
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>6-Tickets per A4 - Tour লাগবে</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@500;600;700;800&family=Inter:wght@500;600;700;800;900&display=swap" rel="stylesheet">
          <style>
            @page { 
              size: A4 portrait; 
              margin: 0; 
            }
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              box-sizing: border-box;
            }
            body { 
              font-family: 'Inter', 'Hind Siliguri', sans-serif; 
              background: #ffffff; 
              margin: 0; 
              padding: 0; 
            }
            .page-container {
              width: 210mm;
              height: 297mm;
              display: grid;
              grid-template-columns: repeat(2, 105mm);
              grid-template-rows: repeat(3, 99mm);
              page-break-after: always;
              box-sizing: border-box;
            }
            .ticket-card {
              width: 105mm;
              height: 99mm;
              border: 0.5pt dashed #cbd5e1;
              padding: 5mm 6mm;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              overflow: hidden;
              position: relative;
              background: #ffffff;
            }
          </style>
        </head>
        <body onload="window.print()">
          ${Array.from({ length: Math.ceil(ticketsToPrint.length / 6) }).map((_, pageIdx) => {
            const pageTickets = ticketsToPrint.slice(pageIdx * 6, (pageIdx + 1) * 6);
            return `
              <div class="page-container">
                ${pageTickets.map(g => {
                  const info = g.leadBooking;
                  const seatDisplay = g.seatsList.join(', ');
                  const qrData = `TOUR-LAGBE|TICKET:${g.id}|SEATS:${seatDisplay}|PRIMARY:${info.name}|PHONE:${info.mobile}`;
                  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(qrData)}`;
                  
                  return `
                    <div class="ticket-card">
                      <!-- Ticket Header -->
                      <div class="flex justify-between items-center border-b border-gray-200 pb-2">
                        <div class="flex items-center gap-2">
                          <img src="${BUSINESS_INFO.logo}" class="h-8 object-contain" />
                          <div>
                            <h1 class="font-black text-sm text-[#001D4A] tracking-tight leading-tight">${BUSINESS_INFO.name}</h1>
                            <p class="text-[8px] font-black text-orange-600 uppercase tracking-wider leading-none mt-0.5">
                              ${g.totalSeats > 1 ? `★ Combined Pass (${g.totalSeats} Seats)` : '★ Official Boarding Pass'}
                            </p>
                          </div>
                        </div>
                        <div class="bg-[#001D4A] text-white px-3 py-1.5 rounded-xl flex flex-col items-center max-w-[46mm] shadow-sm">
                          <span class="text-[7px] font-black uppercase tracking-widest opacity-80 leading-none mb-0.5">
                            ${g.totalSeats > 1 ? `SEATS (${g.totalSeats})` : 'SEAT'}
                          </span>
                          <span class="text-base font-black leading-none truncate max-w-full text-amber-300">${seatDisplay}</span>
                        </div>
                      </div>

                      <!-- Tour & Passenger Info -->
                      <div class="grid grid-cols-12 gap-2 my-auto py-1">
                        <div class="col-span-8 space-y-1.5">
                          <div>
                            <p class="text-[7px] font-black uppercase text-gray-400 tracking-wider leading-none">Primary Passenger</p>
                            <p class="text-[14px] font-black text-gray-950 truncate leading-tight mt-0.5">${info.name}</p>
                            <p class="text-[9px] font-bold text-gray-600 mt-0.5 flex items-center gap-1">
                              <span>+880${info.mobile}</span>
                              <span>•</span>
                              <span>${info.gender || 'MALE'}</span>
                              ${info.religion ? `<span>• ${info.religion}</span>` : ''}
                            </p>
                          </div>

                          <div class="bg-indigo-50/70 p-1.5 rounded-lg border border-indigo-100/80">
                            <p class="text-[7px] font-black uppercase text-indigo-500 tracking-wider leading-none">Tour Destination</p>
                            <p class="text-[11px] font-black text-indigo-950 leading-tight truncate mt-0.5">${info.tourName || info.busNo}</p>
                          </div>

                          <div class="flex gap-4 pt-0.5">
                            <div class="bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200/60 flex-1">
                              <p class="text-[7px] font-black uppercase text-emerald-700 leading-none">Total Paid</p>
                              <p class="text-[12px] font-black text-emerald-700 leading-none mt-0.5">৳${g.totalAdvance.toLocaleString()}</p>
                            </div>
                            <div class="bg-rose-50 px-2 py-1 rounded-md border border-rose-200/60 flex-1">
                              <p class="text-[7px] font-black uppercase text-rose-700 leading-none">Total Due</p>
                              <p class="text-[12px] font-black text-rose-700 leading-none mt-0.5">৳${g.totalDue.toLocaleString()}</p>
                            </div>
                          </div>
                        </div>

                        <!-- QR Code & ID -->
                        <div class="col-span-4 flex flex-col items-center justify-center pl-1 border-l border-dashed border-gray-200">
                          <div class="p-1 bg-white rounded-lg border border-gray-200 shadow-sm">
                            <img src="${qrCodeUrl}" class="w-16 h-16 object-contain" />
                          </div>
                          <p class="text-[8px] text-gray-600 font-black mt-1 uppercase tracking-wider">ID: ${g.id.slice(0, 8)}</p>
                          <span class="text-[6px] font-bold text-gray-400">Scan for Verification</span>
                        </div>
                      </div>

                      <!-- Ticket Footer -->
                      <div class="flex justify-between items-center pt-1.5 border-t border-dashed border-gray-200">
                        <div class="text-[8px] font-bold text-gray-600 leading-snug">
                          <p class="font-extrabold text-gray-900">
                            Booker: <span class="text-indigo-900">${g.agentName}</span> ${g.agentPhone ? `<span class="text-gray-500 font-semibold">(+880${g.agentPhone})</span>` : ''}
                          </p>
                          <p class="text-[7px] text-gray-400 mt-0.5">Issue Date: ${new Date(info.bookingDate).toLocaleDateString()}</p>
                        </div>
                        <span class="px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider ${
                          g.totalDue <= 0 
                            ? 'bg-emerald-600 text-white shadow-sm' 
                            : 'bg-amber-500 text-white shadow-sm'
                        }">
                          ${g.totalDue <= 0 ? '✓ PAID FULL' : '⚠ PARTIAL DUE'}
                        </span>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            `;
          }).join('')}
        </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  /**
   * Print 10 Food Tokens per A4 Sheet (2 Columns x 5 Rows)
   * A4 dimensions: 210mm x 297mm
   * Each token: 105mm x 59.4mm
   */
  const handlePrintFoodTokens = () => {
    if (selectedForPrint.length === 0) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const bookingsToPrint = allBookings.filter(b => selectedForPrint.includes(b.id));

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>10-Tokens per A4 - Tour লাগবে</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@500;600;700;800&family=Inter:wght@500;600;700;800;900&display=swap" rel="stylesheet">
          <style>
            @page { 
              size: A4 portrait; 
              margin: 0; 
            }
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              box-sizing: border-box;
            }
            body { 
              font-family: 'Inter', 'Hind Siliguri', sans-serif; 
              background: #ffffff; 
              margin: 0; 
              padding: 0; 
            }
            .token-page { 
              width: 210mm; 
              height: 297mm; 
              display: grid; 
              grid-template-columns: repeat(2, 105mm); 
              grid-template-rows: repeat(5, 59.4mm);
              page-break-after: always;
              box-sizing: border-box;
            }
            .token-card { 
              width: 105mm;
              height: 59.4mm;
              border: 0.5pt dashed #cbd5e1; 
              padding: 4.5mm 6mm; 
              display: flex; 
              flex-direction: column; 
              justify-content: space-between;
              position: relative;
              overflow: hidden;
              box-sizing: border-box;
              background: #ffffff;
            }
            .token-watermark {
              position: absolute;
              font-size: 32px;
              font-weight: 900;
              color: rgba(249, 115, 22, 0.04);
              z-index: 0;
              pointer-events: none;
              white-space: nowrap;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%) rotate(-8deg);
              letter-spacing: 2px;
            }
          </style>
        </head>
        <body onload="window.print()">
          ${Array.from({ length: Math.ceil(bookingsToPrint.length / 10) }).map((_, pageIdx) => {
            const pageBookings = bookingsToPrint.slice(pageIdx * 10, (pageIdx + 1) * 10);
            return `
              <div class="token-page">
                ${pageBookings.map(info => `
                  <div class="token-card">
                    <div class="token-watermark">🍽️ ${foodType.toUpperCase()}</div>
                    
                    <!-- Token Header -->
                    <div class="relative z-10 flex justify-between items-center border-b border-gray-200 pb-1.5">
                      <div class="flex items-center gap-2">
                        <img src="${BUSINESS_INFO.logo}" class="h-6 object-contain" />
                        <div>
                          <span class="text-[10px] font-black text-[#001D4A] uppercase tracking-tight leading-none block">${BUSINESS_INFO.name}</span>
                          <span class="text-[8px] font-black text-orange-600 uppercase tracking-wider leading-none mt-0.5 block">🍽️ ${foodType} Token</span>
                        </div>
                      </div>
                      <div class="bg-[#001D4A] text-white px-3 py-1 rounded-xl flex items-center gap-1.5 shadow-sm">
                        <span class="text-[7px] font-black uppercase opacity-75 leading-none">SEAT</span>
                        <span class="text-sm font-black leading-none text-amber-300">${info.seatNo}</span>
                      </div>
                    </div>

                    <!-- Passenger & Meal Info -->
                    <div class="relative z-10 flex justify-between items-center py-1">
                      <div class="max-w-[155px]">
                        <p class="text-[12px] font-black text-gray-950 truncate leading-tight">${info.name}</p>
                        <p class="text-[8px] font-extrabold text-indigo-900 mt-0.5 truncate">${info.tourName || info.busNo}</p>
                      </div>
                      <div class="text-right bg-orange-50/80 px-2 py-1 rounded-lg border border-orange-200/60">
                        <span class="text-[7px] font-black text-orange-600 uppercase block leading-none">Serving Time</span>
                        <span class="text-[11px] font-black text-orange-700 leading-none mt-0.5 block">${foodTime}</span>
                      </div>
                    </div>

                    <!-- Token Footer / Menu -->
                    <div class="relative z-10 flex justify-between items-center pt-1 border-t border-dashed border-gray-200">
                      <div class="truncate max-w-[185px]">
                        <span class="text-[7px] font-black text-gray-400 uppercase mr-1">Menu:</span>
                        <span class="text-[8px] font-bold text-gray-700">${foodMenu}</span>
                      </div>
                      <span class="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-[7px] font-black uppercase">1 Person</span>
                    </div>
                  </div>
                `).join('')}
              </div>
            `;
          }).join('')}
        </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const [noticeContent, setNoticeContent] = useState('');
  const [noticeType, setNoticeType] = useState('info');

  const handleNoticePost = async () => {
    if (!noticeContent.trim()) return;
    try {
      const { error } = await supabase.from('tl_notices').insert({
        content: noticeContent,
        type: noticeType,
        is_active: true
      });
      if (error) throw error;
      setNoticeContent('');
      notify?.("Notice published!", 'success');
    } catch (e) {
      notify?.("Failed to post notice.", 'error');
    }
  };

  const navTabs = [
    { id: 'tours', label: 'Tours & Routes', icon: 'fa-route' },
    { id: 'layout', label: 'Bus Layout', icon: 'fa-bus' },
    { id: 'hotel', label: 'Hotel & Rooms', icon: 'fa-hotel' },
    { id: 'agents', label: 'Agents', icon: 'fa-user-tie' },
    { id: 'types', label: 'Pricing', icon: 'fa-tags' },
    { id: 'print', label: 'Tickets (6/A4)', icon: 'fa-print' },
    { id: 'food', label: 'Food (10/A4)', icon: 'fa-utensils' },
    { id: 'notices', label: 'Notices', icon: 'fa-bullhorn' },
    { id: 'database', label: 'Database SQL', icon: 'fa-database' }
  ];

  const moveType = async (index: number, direction: 'up' | 'down') => {
    const newTypes = [...customerTypes];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newTypes.length) return;

    const current = { ...newTypes[index] };
    const target = { ...newTypes[targetIndex] };

    const currentOrder = current.sort_order || index;
    const targetOrder = target.sort_order || targetIndex;

    await onUpsertCustomerType({ ...current, sort_order: targetOrder });
    await onUpsertCustomerType({ ...target, sort_order: currentOrder });
  };

  const moveTour = async (index: number, direction: 'up' | 'down') => {
    const newToursList = [...tours];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newToursList.length) return;

    const current = { ...newToursList[index] };
    const target = { ...newToursList[targetIndex] };

    const currentOrder = current.sort_order || index;
    const targetOrder = target.sort_order || targetIndex;

    await onUpsertTour({ ...current, sort_order: targetOrder });
    await onUpsertTour({ ...target, sort_order: currentOrder });
  };

  return (
    <div className="max-w-6xl mx-auto pb-20 px-2 md:px-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-[#001D4A] tracking-tighter uppercase">
            Admin Control Center (এডমিন প্যানেল)
          </h2>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
            Tour Configuration, Bus Layout, Hotel Allocations & Batch Print
          </p>
        </div>
      </div>

      {/* Navigation Tabs - Mobile Optimized Horizontal Scroll / Wrap */}
      <div className="flex overflow-x-auto no-scrollbar md:flex-wrap bg-white p-1.5 rounded-[24px] sm:rounded-[28px] shadow-sm mb-6 md:mb-8 gap-1.5 border border-gray-100 -mx-1 px-2 sm:mx-0">
        {navTabs.map(tab => (
          <button 
            key={tab.id} 
            onClick={() => setActiveSubTab(tab.id as any)} 
            className={`flex items-center justify-center shrink-0 gap-1.5 md:gap-2 px-3.5 py-2.5 sm:px-4 sm:py-3 md:px-5 md:py-3.5 rounded-[18px] sm:rounded-[20px] transition-all uppercase active:scale-95 ${
              activeSubTab === tab.id ? 'bg-[#001D4A] text-white shadow-lg' : 'text-gray-500 hover:text-gray-800 bg-gray-50/60 md:bg-transparent'
            }`}
          >
            <i className={`fas ${tab.icon} text-xs`}></i>
            <span className="font-black text-[9px] sm:text-[10px] whitespace-nowrap">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* SUB-TAB 1: TOURS & ROUTES (Enhanced with Tour Type, Couple Extra Fee & Hotel) */}
      {activeSubTab === 'tours' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <form onSubmit={addTour} className="bg-white p-6 md:p-8 rounded-[32px] shadow-sm border border-gray-100 flex flex-col gap-5">
            <h4 className="font-black text-[11px] uppercase text-[#001D4A] tracking-widest border-l-4 border-orange-500 pl-3">
              ট্যুর রুট ও ফি কনফিগারেশন (Add New Tour Route)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-gray-400">ট্যুর নাম (Tour Name) *</label>
                <input
                  required
                  className="w-full px-4 py-3.5 bg-gray-50 border-none rounded-2xl font-bold text-xs text-[#001D4A] outline-none"
                  placeholder="e.g. Sajek Valley Relax Tour"
                  value={newTour.name}
                  onChange={e => setNewTour({ ...newTour, name: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-gray-400">ট্যুর ফি (Base Fee ৳) *</label>
                <input
                  required
                  type="number"
                  className="w-full px-4 py-3.5 bg-gray-50 border-none rounded-2xl font-bold text-xs text-[#001D4A] outline-none"
                  placeholder="4500"
                  value={newTour.fee || ''}
                  onChange={e => setNewTour({ ...newTour, fee: Number(e.target.value) })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-gray-400">ট্যুরের ধরন (Tour Type) *</label>
                <select
                  value={newTour.tour_type}
                  onChange={e => setNewTour({ ...newTour, tour_type: e.target.value as 'Day Long' | 'Relax' })}
                  className="w-full px-4 py-3.5 bg-gray-50 border-none rounded-2xl font-black text-xs text-indigo-700 outline-none uppercase"
                >
                  <option value="Day Long">Day Long (ডে লং)</option>
                  <option value="Relax">Relax Tour (রিলাক্স ট্যুর)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-gray-400">কাপল এক্সট্রা ফি (Couple Extra Fee ৳)</label>
                <input
                  type="number"
                  className="w-full px-4 py-3.5 bg-gray-50 border-none rounded-2xl font-bold text-xs text-[#001D4A] outline-none"
                  placeholder="1000"
                  value={newTour.couple_extra_fee || ''}
                  onChange={e => setNewTour({ ...newTour, couple_extra_fee: Number(e.target.value) })}
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-[9px] font-black uppercase text-gray-400">হোটেল / রিসোর্ট নাম (Hotel Name - Optional)</label>
                <input
                  className="w-full px-4 py-3.5 bg-gray-50 border-none rounded-2xl font-bold text-xs text-[#001D4A] outline-none"
                  placeholder="e.g. Resort RungRang / MeghKabya"
                  value={newTour.hotel_name}
                  onChange={e => setNewTour({ ...newTour, hotel_name: e.target.value })}
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-2xl font-black shadow-lg uppercase text-xs tracking-widest active:scale-95 transition-all"
            >
              ট্যুর যুক্ত করুন (Register Tour Route)
            </button>
          </form>

          {/* Tours List */}
          <div className="space-y-3">
            {tours.map((t, i) => (
              <div key={i} className="bg-white p-5 rounded-[28px] border border-gray-100 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex-grow w-full">
                  {editTourIndex === i ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                      <input
                        className="px-3 py-2 border rounded-xl text-xs font-bold"
                        value={editTourData?.name || ''}
                        onChange={e => setEditTourData({ ...editTourData!, name: e.target.value })}
                        placeholder="Tour Name"
                      />
                      <input
                        type="number"
                        className="px-3 py-2 border rounded-xl text-xs font-bold"
                        value={editTourData?.fee || 0}
                        onChange={e => setEditTourData({ ...editTourData!, fee: Number(e.target.value) })}
                        placeholder="Fee"
                      />
                      <select
                        value={editTourData?.tour_type || 'Day Long'}
                        onChange={e => setEditTourData({ ...editTourData!, tour_type: e.target.value as 'Day Long' | 'Relax' })}
                        className="px-3 py-2 border rounded-xl text-xs font-black"
                      >
                        <option value="Day Long">Day Long</option>
                        <option value="Relax">Relax</option>
                      </select>
                      <input
                        type="number"
                        className="px-3 py-2 border rounded-xl text-xs font-bold"
                        value={editTourData?.couple_extra_fee || 0}
                        onChange={e => setEditTourData({ ...editTourData!, couple_extra_fee: Number(e.target.value) })}
                        placeholder="Couple Extra"
                      />
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-black text-[#001D4A] text-sm uppercase">{t.name}</p>
                        <span className={`text-[8px] font-black px-2 py-0.5 rounded-md uppercase ${
                          t.tour_type === 'Relax' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {t.tour_type || 'Day Long'}
                        </span>
                        {t.hotel_name && (
                          <span className="text-[8px] font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">
                            🏨 {t.hotel_name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1">
                        <p className="text-[10px] font-black text-indigo-600">Base Fee: ৳{t.fee.toLocaleString()}</p>
                        {t.couple_extra_fee ? (
                          <p className="text-[10px] font-black text-pink-600">Couple Extra: +৳{t.couple_extra_fee.toLocaleString()}</p>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end md:self-center">
                  <div className="flex flex-col gap-1 mr-2">
                    <button onClick={() => moveTour(i, 'up')} disabled={i === 0} className="text-gray-300 hover:text-orange-600 disabled:opacity-30">
                      <i className="fas fa-chevron-up text-[10px]"></i>
                    </button>
                    <button onClick={() => moveTour(i, 'down')} disabled={i === tours.length - 1} className="text-gray-300 hover:text-orange-600 disabled:opacity-30">
                      <i className="fas fa-chevron-down text-[10px]"></i>
                    </button>
                  </div>
                  {editTourIndex === i ? (
                    <button onClick={saveTourEdit} className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
                      <i className="fas fa-check"></i>
                    </button>
                  ) : (
                    <>
                      <button onClick={() => { setEditTourIndex(i); setEditTourData(t); }} className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                        <i className="fas fa-pen text-[10px]"></i>
                      </button>
                      <button onClick={() => onDeleteTour(t.name)} className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center">
                        <i className="fas fa-trash-alt text-[10px]"></i>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: BUS LAYOUT CUSTOMIZER */}
      {activeSubTab === 'layout' && (
        <div className="animate-in fade-in duration-300">
          <BusLayoutEditor
            currentLayout={busLayout}
            tours={tours}
            selectedTour={tours[0]?.name || ''}
            onSaveLayout={onSaveBusLayout}
            notify={notify}
          />
        </div>
      )}

      {/* SUB-TAB 3: HOTEL & ROOM ALLOCATION MANAGER */}
      {activeSubTab === 'hotel' && (
        <div className="animate-in fade-in duration-300">
          <HotelManager
            hotels={hotels}
            rooms={rooms}
            tours={tours}
            allBookings={allBookings}
            isAdmin={true}
            onAddHotel={onAddHotel}
            onUpdateHotel={onUpdateHotel}
            onDeleteHotel={onDeleteHotel}
            onAddRoom={onAddRoom}
            onUpdateRoom={onUpdateRoom}
            onDeleteRoom={onDeleteRoom}
            onAssignPassenger={onAssignPassenger}
            onUnassignPassenger={onUnassignPassenger}
            notify={notify}
          />
        </div>
      )}

      {/* SUB-TAB 4: AGENTS / BOOKERS */}
      {activeSubTab === 'agents' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <form onSubmit={addAgent} className="bg-white p-6 md:p-8 rounded-[32px] shadow-sm border flex flex-col gap-5">
            <h4 className="font-black text-[10px] uppercase text-[#001D4A] tracking-widest border-l-4 border-indigo-500 pl-3">Register Agent (নাম ও ফোন নম্বর)</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-gray-400">ID Code</label>
                <input required className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl font-black uppercase text-sm tracking-widest" placeholder="KS101" value={newAgent.code} onChange={e => setNewAgent({...newAgent, code: e.target.value.toUpperCase()})} />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-gray-400">Full Name</label>
                <input required className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl font-bold text-sm" placeholder="Kazi Shetu" value={newAgent.name} onChange={e => setNewAgent({...newAgent, name: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-gray-400">Mobile / Phone Number</label>
                <input required className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl font-bold text-sm" placeholder="017XXXXXXXX" value={newAgent.phone} onChange={e => setNewAgent({...newAgent, phone: e.target.value})} />
              </div>
            </div>
            <button type="submit" className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black shadow-lg uppercase text-xs tracking-widest active:scale-95 transition-all">Add Agent</button>
          </form>

          <div className="space-y-3">
            {agents.map((a, i) => (
              <div key={i} className="bg-white p-5 rounded-[28px] border border-gray-100 shadow-sm flex items-center justify-between">
                <div className="flex-grow">
                  {editAgentIndex === i ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input className="px-3 py-2 border rounded-xl text-xs font-black uppercase" value={editAgentData?.code || ''} onChange={e => setEditAgentData({...editAgentData!, code: e.target.value.toUpperCase()})} placeholder="Code" />
                      <input className="px-3 py-2 border rounded-xl text-xs font-bold" value={editAgentData?.name || ''} onChange={e => setEditAgentData({...editAgentData!, name: e.target.value})} placeholder="Name" />
                      <input className="px-3 py-2 border rounded-xl text-xs font-bold" value={editAgentData?.mobile || editAgentData?.phone || ''} onChange={e => setEditAgentData({...editAgentData!, mobile: e.target.value, phone: e.target.value})} placeholder="Phone" />
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-black text-[10px] text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-xl uppercase tracking-widest">{a.code}</span>
                      <p className="font-bold text-gray-900 text-sm">{a.name}</p>
                      {(a.mobile || a.phone) && (
                        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                          <i className="fas fa-phone-alt text-[9px]"></i> +880{a.mobile || a.phone}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  {editAgentIndex === i ? (
                    <button onClick={saveAgentEdit} className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center"><i className="fas fa-check"></i></button>
                  ) : (
                    <>
                      <button onClick={() => {setEditAgentIndex(i); setEditAgentData(a);}} className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><i className="fas fa-pen text-[10px]"></i></button>
                      <button onClick={() => onDeleteAgent(a.code)} className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center"><i className="fas fa-trash-alt text-[10px]"></i></button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 5: PRICING CATEGORIES */}
      {activeSubTab === 'types' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <form onSubmit={addType} className="bg-white p-6 md:p-8 rounded-[32px] shadow-sm border flex flex-col gap-5">
            <h4 className="font-black text-[10px] uppercase text-[#001D4A] tracking-widest border-l-4 border-blue-500 pl-3">Pricing Category</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1"><label className="text-[9px] font-black uppercase text-gray-400">Category Name</label><input required className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl font-bold text-sm" placeholder="Solo Traveler" value={newType.type} onChange={e => setNewType({...newType, type: e.target.value})} /></div>
              <div className="space-y-1"><label className="text-[9px] font-black uppercase text-gray-400">Surcharge (৳)</label><input required type="number" className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl font-bold text-sm" placeholder="1500" value={newType.fee || ''} onChange={e => setNewType({...newType, fee: Number(e.target.value)})} /></div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-gray-400">Restricted To Tour</label>
                <select className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl font-bold text-sm outline-none cursor-pointer" value={newType.tour_name || ''} onChange={e => setNewType({...newType, tour_name: e.target.value || undefined})}>
                  <option value="">Global (All Tours)</option>
                  {tours.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                </select>
              </div>
            </div>
            <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black shadow-lg uppercase text-xs tracking-widest active:scale-95 transition-all">Save Category</button>
          </form>

          <div className="space-y-3">
            {customerTypes.map((c, i) => (
              <div key={i} className="bg-white p-5 rounded-[28px] border border-gray-100 shadow-sm flex items-center justify-between">
                <div className="flex-grow">
                  {editTypeIndex === i ? (
                    <div className="flex gap-2">
                      <input className="px-3 py-2 border rounded-xl w-full text-xs font-bold" value={editTypeData?.type || ''} onChange={e => setEditTypeData({...editTypeData!, type: e.target.value})} />
                      <input type="number" className="px-3 py-2 border rounded-xl w-24 text-xs font-bold" value={editTypeData?.fee || 0} onChange={e => setEditTypeData({...editTypeData!, fee: Number(e.target.value)})} />
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <p className="font-black text-[#001D4A] text-sm uppercase">{c.type}</p>
                        {c.tour_name && <span className="text-[8px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-lg uppercase tracking-widest">{c.tour_name}</span>}
                      </div>
                      <p className="text-[10px] font-bold text-blue-600">+৳{c.fee.toLocaleString()}</p>
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="flex flex-col gap-1 mr-2">
                    <button onClick={() => moveType(i, 'up')} disabled={i === 0} className="text-gray-300 hover:text-indigo-600 disabled:opacity-30"><i className="fas fa-chevron-up text-[10px]"></i></button>
                    <button onClick={() => moveType(i, 'down')} disabled={i === customerTypes.length - 1} className="text-gray-300 hover:text-indigo-600 disabled:opacity-30"><i className="fas fa-chevron-down text-[10px]"></i></button>
                  </div>
                  {editTypeIndex === i ? (
                    <button onClick={saveTypeEdit} className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center"><i className="fas fa-check"></i></button>
                  ) : (
                    <>
                      <button onClick={() => {setEditTypeIndex(i); setEditTypeData(c);}} className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><i className="fas fa-pen text-[10px]"></i></button>
                      <button onClick={() => onDeleteCustomerType(c.type)} className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center"><i className="fas fa-trash-alt text-[10px]"></i></button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 6: PRINT TICKETS (6 PER A4) */}
      {activeSubTab === 'print' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-[#001D4A] p-6 md:p-8 rounded-[32px] text-white shadow-xl flex flex-col gap-6">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[9px] font-black text-orange-400 uppercase tracking-widest bg-white/10 px-3 py-1 rounded-full">
                  A4 Batch Print Layout (6 Tickets / Page)
                </span>
                <h3 className="text-xl font-black uppercase tracking-tighter mt-2">
                  টিকেট প্রিন্ট উইজার্ড (Batch Ticket Printing)
                </h3>
                <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mt-0.5">
                  ১টি A4 পেজে ৬টি সুবিন্যস্ত টিকেট প্রিন্ট হবে (2x3 Grid)
                </p>
              </div>
              <div className="flex gap-4">
                <button onClick={() => setSelectedForPrint(filteredPrintBookings.map(b => b.id))} className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Select All</button>
                <button onClick={() => setSelectedForPrint([])} className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Deselect All</button>
              </div>
            </div>
            <button
              onClick={handlePrintBatch}
              disabled={selectedForPrint.length === 0}
              className="w-full py-5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <i className="fas fa-print"></i>
              <span>টিকেট প্রিন্ট করুন ({selectedForPrint.length} টিকেট)</span>
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex gap-2 mb-4 px-1">
              <select value={printFilterTour} onChange={e => setPrintFilterTour(e.target.value)} className="flex-1 bg-white border border-gray-100 px-4 py-3 rounded-2xl text-[10px] font-black uppercase text-indigo-600 outline-none shadow-sm">
                <option value="">All Tours</option>
                {tours.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
              </select>
              <select value={printFilterBooker} onChange={e => setPrintFilterBooker(e.target.value)} className="flex-1 bg-white border border-gray-100 px-4 py-3 rounded-2xl text-[10px] font-black uppercase text-indigo-600 outline-none shadow-sm">
                <option value="">All Agents</option>
                {agents.map(a => <option key={a.code} value={a.code}>{a.name}</option>)}
              </select>
            </div>
            {filteredPrintBookings.length === 0 ? (
              <div className="bg-white py-12 text-center rounded-[32px] border border-dashed border-gray-100"><p className="text-gray-400 font-black uppercase text-[10px] tracking-widest">No Matching Bookings</p></div>
            ) : (
              filteredPrintBookings.map((g) => {
                const b = g.leadBooking;
                const isSelected = selectedForPrint.includes(g.id);
                return (
                  <div key={g.id} onClick={() => setSelectedForPrint(prev => prev.includes(g.id) ? prev.filter(p => p !== g.id) : [...prev, g.id])} className={`bg-white p-5 rounded-[28px] border transition-all cursor-pointer flex items-center justify-between ${isSelected ? 'border-indigo-600 bg-indigo-50 shadow-md' : 'border-gray-100 shadow-sm'}`}>
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center border-2 transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-200 text-transparent'}`}><i className="fas fa-check text-[10px]"></i></div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-black text-[#001D4A] text-sm truncate max-w-[220px]">{b.name}</p>
                          {g.totalSeats > 1 && (
                            <span className="text-[9px] font-black text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md uppercase">
                              Combined ({g.totalSeats} Seats)
                            </span>
                          )}
                        </div>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter mt-0.5">
                          Seats: <span className="text-indigo-900 font-black">{g.seatsList.join(', ')}</span> • {b.tourName || b.busNo} • Agent: {g.agentName} {g.agentPhone ? `(+880${g.agentPhone})` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${g.totalDue <= 0 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                        {g.totalDue <= 0 ? 'Paid' : `Due: ৳${g.totalDue}`}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 7: FOOD TOKENS (10 PER A4) */}
      {activeSubTab === 'food' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-white p-6 md:p-8 rounded-[40px] shadow-sm border border-gray-100 flex flex-col gap-6">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest bg-orange-50 px-3 py-1 rounded-full">
                  A4 Batch Print Layout (10 Tokens / Page)
                </span>
                <h3 className="text-xl font-black text-[#001D4A] tracking-tighter uppercase mt-2">
                  খাবারের টোকেন প্রিন্ট (Food Token Wizard)
                </h3>
                <p className="text-gray-400 text-xs font-bold mt-0.5">
                  ১টি A4 পেজে ১০টি পরিচ্ছন্ন ফুড টোকেন প্রিন্ট হবে (2x5 Grid)
                </p>
              </div>
              <div className="flex gap-4">
                <button onClick={() => setSelectedForPrint(filteredFoodBookings.map(b => b.id))} className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Select All</button>
                <button onClick={() => setSelectedForPrint([])} className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Deselect All</button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Meal Period</label>
                <select value={foodType} onChange={e => setFoodType(e.target.value as any)} className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl font-black text-[#001D4A] uppercase text-xs outline-none">
                  {['Breakfast', 'Lunch', 'Dinner', 'Special Item', 'Snacks', 'Refreshment'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Target Serving Time</label>
                <input type="text" value={foodTime} onChange={e => setFoodTime(e.target.value)} className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl font-black text-orange-600 text-center text-sm outline-none" />
              </div>
              <div className="md:col-span-2 space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Food Menu / Description</label>
                <input type="text" value={foodMenu} onChange={e => setFoodMenu(e.target.value)} placeholder="e.g. Rice, Chicken, Dal, Salad" className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl font-bold text-[#001D4A] text-sm outline-none" />
              </div>
            </div>

            <button
              onClick={handlePrintFoodTokens}
              disabled={selectedForPrint.length === 0}
              className="w-full py-5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-2xl font-black shadow-lg uppercase text-xs tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <i className="fas fa-print"></i>
              <span>টোকেন প্রিন্ট করুন ({selectedForPrint.length} টোকেন)</span>
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex gap-2 mb-4 px-1">
              <select value={foodFilterTour} onChange={e => setFoodFilterTour(e.target.value)} className="flex-1 bg-white border border-gray-100 px-4 py-3 rounded-2xl text-[10px] font-black uppercase text-indigo-600">
                <option value="">All Tours</option>
                {tours.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
              </select>
              <select value={foodFilterBooker} onChange={e => setFoodFilterBooker(e.target.value)} className="flex-1 bg-white border border-gray-100 px-4 py-3 rounded-2xl text-[10px] font-black uppercase text-indigo-600">
                <option value="">All Agents</option>
                {agents.map(a => <option key={a.code} value={a.code}>{a.name}</option>)}
              </select>
            </div>
            {filteredFoodBookings.map(b => (
              <div key={b.id} onClick={() => setSelectedForPrint(prev => prev.includes(b.id) ? prev.filter(p => p !== b.id) : [...prev, b.id])} className={`bg-white p-5 rounded-[28px] border transition-all cursor-pointer flex items-center justify-between ${selectedForPrint.includes(b.id) ? 'border-orange-500 bg-orange-50 shadow-md' : 'border-gray-100 shadow-sm'}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center border-2 transition-all ${selectedForPrint.includes(b.id) ? 'bg-orange-500 border-orange-500 text-white' : 'border-gray-200 text-transparent'}`}><i className="fas fa-check text-[10px]"></i></div>
                  <div>
                    <p className="font-black text-[#001D4A] text-sm uppercase leading-none">{b.name}</p>
                    <p className="text-[9px] font-black text-orange-500 uppercase tracking-tighter mt-1">Seat {b.seatNo} • {b.tourName || b.busNo}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 8: NOTICES */}
      {activeSubTab === 'notices' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex flex-col gap-6 text-center">
            <h3 className="text-xl font-black text-[#001D4A] tracking-tighter uppercase">Global Broadcast</h3>
            <textarea 
              value={noticeContent}
              onChange={e => setNoticeContent(e.target.value)}
              placeholder="Type your important announcement here..."
              className="w-full px-6 py-5 bg-gray-50 border-none rounded-3xl font-bold text-sm outline-none h-32 focus:ring-2 ring-indigo-500/20"
            />
            <div className="flex gap-2 justify-center">
              {['info', 'success', 'error'].map(t => (
                <button key={t} onClick={() => setNoticeType(t)} className={`px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest ${noticeType === t ? 'bg-[#001D4A] text-white' : 'bg-gray-100 text-gray-400'}`}>{t}</button>
              ))}
            </div>
            <button onClick={handleNoticePost} className="w-full py-5 bg-[#001D4A] text-white rounded-2xl font-black shadow-lg uppercase text-xs tracking-widest active:scale-95 transition-all">Broadcast to All Agents</button>
          </div>

          {notices.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Active Broadcasts</h4>
              {notices.map(notice => (
                <div key={notice.id} className="bg-white p-6 rounded-[32px] border border-gray-100 flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${notice.type === 'error' ? 'bg-red-50 text-red-500' : notice.type === 'success' ? 'bg-green-50 text-green-500' : 'bg-blue-50 text-blue-500'}`}>
                      <i className="fas fa-bullhorn text-sm"></i>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-800">{notice.content}</p>
                      <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mt-1">Status: {notice.type}</p>
                    </div>
                  </div>
                  <button onClick={() => onDeactivateNotice?.(notice.id)} className="w-10 h-10 bg-gray-50 text-gray-400 rounded-xl flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-colors">
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 9: DATABASE SCHEMA & MIGRATION SQL */}
      {activeSubTab === 'database' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-white p-6 md:p-8 rounded-[40px] shadow-sm border border-gray-100 space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 pb-5">
              <div>
                <h3 className="text-xl font-black text-[#001D4A] tracking-tighter uppercase flex items-center gap-2">
                  <i className="fas fa-database text-orange-500"></i>
                  Supabase Database Schema Setup
                </h3>
                <p className="text-xs text-gray-500 mt-1 font-medium">
                  If Supabase returns schema cache warnings (e.g. missing columns like <code className="bg-gray-100 px-1 py-0.5 rounded text-orange-600 font-bold">group_seats_list</code>), run this script in your Supabase SQL Editor.
                </p>
              </div>
              <button
                onClick={() => {
                  const sql = `-- Tour Lagbe Supabase Migration Script
-- 1. Bookings table and extended group/room columns
CREATE TABLE IF NOT EXISTS tl_bookings (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  address TEXT,
  gender TEXT,
  religion TEXT,
  tour_name TEXT,
  tour_fees NUMERIC DEFAULT 0,
  customer_type TEXT,
  customer_type_fees NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  advance_amount NUMERIC DEFAULT 0,
  due_amount NUMERIC DEFAULT 0,
  payment_status TEXT DEFAULT 'Unpaid',
  bus_no TEXT NOT NULL,
  seat_no TEXT NOT NULL,
  booked_by TEXT,
  booker_code TEXT,
  booking_date TEXT,
  is_primary BOOLEAN DEFAULT true,
  primary_booking_id TEXT,
  total_group_seats INTEGER DEFAULT 1,
  group_seats_list TEXT,
  hotel_room_no TEXT,
  hotel_name TEXT
);

ALTER TABLE tl_bookings ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT true;
ALTER TABLE tl_bookings ADD COLUMN IF NOT EXISTS primary_booking_id TEXT;
ALTER TABLE tl_bookings ADD COLUMN IF NOT EXISTS total_group_seats INTEGER DEFAULT 1;
ALTER TABLE tl_bookings ADD COLUMN IF NOT EXISTS group_seats_list TEXT;
ALTER TABLE tl_bookings ADD COLUMN IF NOT EXISTS hotel_room_no TEXT;
ALTER TABLE tl_bookings ADD COLUMN IF NOT EXISTS hotel_name TEXT;

-- 2. Tours Table
CREATE TABLE IF NOT EXISTS tl_tours (
  name TEXT PRIMARY KEY,
  fee NUMERIC NOT NULL DEFAULT 0,
  tour_type TEXT DEFAULT 'Day Long',
  couple_extra_fee NUMERIC DEFAULT 0,
  hotel_name TEXT,
  sort_order INTEGER DEFAULT 0
);
ALTER TABLE tl_tours ADD COLUMN IF NOT EXISTS tour_type TEXT DEFAULT 'Day Long';
ALTER TABLE tl_tours ADD COLUMN IF NOT EXISTS couple_extra_fee NUMERIC DEFAULT 0;
ALTER TABLE tl_tours ADD COLUMN IF NOT EXISTS hotel_name TEXT;
ALTER TABLE tl_tours ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- 3. Agents Table
CREATE TABLE IF NOT EXISTS tl_agents (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  last_active TIMESTAMP WITH TIME ZONE
);

-- 4. Pricing Types Table
CREATE TABLE IF NOT EXISTS tl_customer_types (
  type TEXT PRIMARY KEY,
  fee NUMERIC NOT NULL DEFAULT 0,
  tour_name TEXT,
  sort_order INTEGER DEFAULT 0
);
ALTER TABLE tl_customer_types ADD COLUMN IF NOT EXISTS tour_name TEXT;
ALTER TABLE tl_customer_types ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- 5. Seat Locks Table
CREATE TABLE IF NOT EXISTS tl_locks (
  bus_no TEXT NOT NULL,
  seat_no TEXT NOT NULL,
  agent_code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY (bus_no, seat_no)
);

-- 6. Expenses Table
CREATE TABLE IF NOT EXISTS tl_expenses (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  description TEXT,
  date TEXT NOT NULL,
  recorded_by TEXT,
  agent_code TEXT,
  tour_name TEXT
);

-- 7. Global Notices Table
CREATE TABLE IF NOT EXISTS tl_notices (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`;
                  navigator.clipboard.writeText(sql);
                  setCopiedSql(true);
                  notify?.("SQL Migration Script copied to clipboard!", 'success');
                  setTimeout(() => setCopiedSql(false), 3000);
                }}
                className="px-6 py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-md hover:brightness-110 active:scale-95 transition-all flex items-center gap-2"
              >
                <i className={`fas ${copiedSql ? 'fa-check' : 'fa-copy'}`}></i>
                <span>{copiedSql ? 'Copied!' : 'Copy SQL Script'}</span>
              </button>
            </div>

            <div className="bg-[#001D4A] p-5 rounded-3xl text-xs font-mono text-cyan-200 overflow-x-auto max-h-96 leading-relaxed border border-white/10 select-all">
              <pre>{`-- 1. Ensure all columns exist in tl_bookings table:
ALTER TABLE tl_bookings ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT true;
ALTER TABLE tl_bookings ADD COLUMN IF NOT EXISTS primary_booking_id TEXT;
ALTER TABLE tl_bookings ADD COLUMN IF NOT EXISTS total_group_seats INTEGER DEFAULT 1;
ALTER TABLE tl_bookings ADD COLUMN IF NOT EXISTS group_seats_list TEXT;
ALTER TABLE tl_bookings ADD COLUMN IF NOT EXISTS hotel_room_no TEXT;
ALTER TABLE tl_bookings ADD COLUMN IF NOT EXISTS hotel_name TEXT;

-- 2. Ensure all columns exist in tl_tours table:
ALTER TABLE tl_tours ADD COLUMN IF NOT EXISTS tour_type TEXT DEFAULT 'Day Long';
ALTER TABLE tl_tours ADD COLUMN IF NOT EXISTS couple_extra_fee NUMERIC DEFAULT 0;
ALTER TABLE tl_tours ADD COLUMN IF NOT EXISTS hotel_name TEXT;
ALTER TABLE tl_tours ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- 3. Ensure all columns exist in tl_customer_types table:
ALTER TABLE tl_customer_types ADD COLUMN IF NOT EXISTS tour_name TEXT;
ALTER TABLE tl_customer_types ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;`}</pre>
            </div>

            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-900 text-xs flex items-start gap-3">
              <i className="fas fa-shield-alt text-emerald-600 text-base mt-0.5"></i>
              <div>
                <p className="font-bold">Auto Fallback Active</p>
                <p className="text-emerald-700 text-[11px] mt-0.5">
                  The application automatically protects all bookings and master data with graceful schema fallback, meaning booking and saving will always succeed smoothly even before running this SQL script!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
