import React, { useState } from 'react';
import { Notice } from '../types';

interface NotificationCenterProps {
  notifications: Notice[];
  readIds: string[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearNotification: (id: string) => void;
  onClearAllNotifications: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  readIds,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearNotification,
  onClearAllNotifications
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread'>('all');

  const unreadCount = notifications.filter(n => !readIds.includes(String(n.id))).length;

  const displayList = activeFilter === 'unread' 
    ? notifications.filter(n => !readIds.includes(String(n.id)))
    : notifications;

  return (
    <div className="relative">
      {/* Bell Icon Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative w-11 h-11 md:w-12 md:h-12 rounded-2xl flex items-center justify-center transition-all ${
          isOpen 
            ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30 ring-4 ring-orange-500/20' 
            : 'bg-white text-gray-700 hover:bg-gray-100 hover:text-indigo-900 border border-gray-200/80 shadow-sm'
        }`}
        title="নোটিফিকেশন সেন্টার (Notification Alerts)"
        aria-label="Notifications"
      >
        <i className="fas fa-bell text-lg md:text-xl"></i>
        
        {/* Unread Badge Counter */}
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-md animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Backdrop overlay for closing on outside click */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/20 md:bg-transparent"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Notification Dropdown Panel */}
      {isOpen && (
        <div className="fixed sm:absolute top-20 sm:top-auto right-3 sm:right-0 max-w-[calc(100vw-24px)] w-[350px] sm:w-[380px] md:w-[420px] bg-white rounded-3xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
          
          {/* Panel Header */}
          <div className="p-4 md:p-5 bg-gradient-to-r from-[#001D4A] to-[#002B6B] text-white flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-orange-400">
                <i className="fas fa-bell text-sm"></i>
              </div>
              <div>
                <h4 className="font-black text-sm md:text-base leading-none">নোটিফিকেশন অ্যালার্ট</h4>
                <p className="text-[10px] text-white/60 font-bold mt-1">
                  {unreadCount > 0 ? `${unreadCount} টি অপঠিত নোটিফিকেশন` : 'সব নোটিফিকেশন পড়া হয়েছে'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center text-xs transition-all active:scale-95"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>

          {/* Quick Action Controls & Filters */}
          <div className="p-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between gap-2 text-xs">
            {/* Filter Tabs */}
            <div className="flex bg-gray-200/70 p-1 rounded-xl">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                  activeFilter === 'all' ? 'bg-white text-indigo-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                onClick={() => setActiveFilter('unread')}
                className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                  activeFilter === 'unread' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Unread ({unreadCount})
              </button>
            </div>

            {/* Batch Action Buttons */}
            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  onClick={onMarkAllAsRead}
                  className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1 active:scale-95"
                  title="সব নোটিফিকেশন পড়া হয়েছে মার্ক করুন"
                >
                  <i className="fas fa-check-double text-[9px]"></i>
                  <span>All Read</span>
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={onClearAllNotifications}
                  className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1 active:scale-95"
                  title="সব নোটিফিকেশন মুছে ফেলুন"
                >
                  <i className="fas fa-trash-alt text-[9px]"></i>
                  <span>All Clear</span>
                </button>
              )}
            </div>
          </div>

          {/* Notification List Scrollable Area */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-gray-100">
            {displayList.length === 0 ? (
              <div className="py-12 px-6 text-center text-gray-400">
                <i className="fas fa-bell-slash text-3xl text-gray-300 mb-2 block"></i>
                <p className="font-bold text-xs">
                  {activeFilter === 'unread' ? 'কোন অপঠিত নোটিফিকেশন নেই' : 'কোনো নোটিফিকেশন হিস্ট্রি নেই'}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {activeFilter === 'unread' 
                    ? 'আগের সব নোটিফিকেশন "All" ট্যাবে দেখতে পাবেন।' 
                    : 'নতুন বুকিং বা আপডেটের অ্যালার্ট এখানে সংরক্ষিত থাকবে।'}
                </p>
              </div>
            ) : (
              displayList.map(notice => {
                const noticeIdStr = String(notice.id);
                const isRead = readIds.includes(noticeIdStr);
                
                return (
                  <div
                    key={noticeIdStr}
                    className={`p-4 transition-all flex items-start gap-3 relative ${
                      isRead ? 'bg-white hover:bg-gray-50/80' : 'bg-orange-50/40 hover:bg-orange-50/60'
                    }`}
                  >
                    {/* Notice Icon */}
                    <div className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-xs mt-0.5 ${
                      notice.type === 'error' 
                        ? 'bg-rose-100 text-rose-600' 
                        : notice.type === 'success' 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : 'bg-indigo-100 text-indigo-700'
                    }`}>
                      <i className={`fas ${
                        notice.type === 'error' 
                          ? 'fa-trash' 
                          : notice.type === 'success' 
                            ? 'fa-ticket' 
                            : 'fa-bullhorn'
                      }`}></i>
                    </div>

                    {/* Notice Content & Controls */}
                    <div className="flex-1 min-w-0 pr-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        {isRead ? (
                          <span className="text-[8px] font-black text-gray-400 bg-gray-100 px-1.5 py-0.2 rounded uppercase flex items-center gap-1">
                            <i className="fas fa-check text-[7px] text-emerald-500"></i> Read
                          </span>
                        ) : (
                          <span className="text-[8px] font-black text-white bg-orange-500 px-1.5 py-0.2 rounded uppercase animate-pulse">
                            New Unread
                          </span>
                        )}
                      </div>

                      <p className={`text-xs leading-snug break-words ${isRead ? 'font-medium text-gray-600' : 'font-bold text-[#001D4A]'}`}>
                        {notice.content}
                      </p>
                      
                      {/* Item Bottom Actions */}
                      <div className="flex items-center gap-3 mt-2.5">
                        {!isRead ? (
                          <button
                            onClick={() => onMarkAsRead(noticeIdStr)}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 active:scale-95"
                            title="পড়া হয়েছে চিহ্নিত করুন (Unread ও ব্যানার থেকে হাইড হবে, All-এ সংরক্ষিত থাকবে)"
                          >
                            <i className="fas fa-check text-[9px]"></i>
                            <span>Read</span>
                          </button>
                        ) : (
                          <span className="text-[9px] font-semibold text-gray-400 flex items-center gap-1">
                            <i className="fas fa-archive text-[8px]"></i> সংরক্ষিত (All)
                          </span>
                        )}

                        <button
                          onClick={() => onClearNotification(noticeIdStr)}
                          className="px-2 py-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 ml-auto active:scale-95"
                          title="মুছে ফেলুন"
                        >
                          <i className="fas fa-times text-[9px]"></i>
                          <span>Clear</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Panel Footer */}
          {notifications.length > 0 && (
            <div className="p-3 bg-gray-50 border-t border-gray-100 text-center">
              <span className="text-[10px] font-bold text-gray-400">
                স্বয়ংক্রিয় ক্লাউড লাইভ নোটিফিকেশন
              </span>
            </div>
          )}

        </div>
      )}
    </div>
  );
};
