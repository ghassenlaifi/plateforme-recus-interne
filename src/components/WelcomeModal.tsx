"use client";

import React, { useState, useEffect } from 'react';
import { X, Clock, Calendar } from 'lucide-react';

export function WelcomeModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');

  useEffect(() => {
    // Check local storage for today's date
    const today = new Date().toDateString();
    const lastWelcome = localStorage.getItem('lastWelcomeDate');
    
    if (lastWelcome !== today) {
      setIsOpen(true);
    }

    // Format Date and Time in Arabic (Tunisian locale for western numbers)
    const now = new Date();
    const timeFmt = new Intl.DateTimeFormat('ar-TN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
    const dateFmt = new Intl.DateTimeFormat('ar-TN', { weekday: 'long', day: 'numeric', month: 'long' }).format(now);
    
    setCurrentTime(timeFmt);
    setCurrentDate(dateFmt);
  }, []);

  const handleClose = () => {
    const today = new Date().toDateString();
    localStorage.setItem('lastWelcomeDate', today);
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={handleClose}></div>
      
      <div 
        className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        style={{ fontFamily: "'Tajawal', sans-serif" }}
      >
        {/* Top accent border */}
        <div className="h-1.5 w-full bg-[#f59e0b]"></div>
        
        {/* Close Button */}
        <button 
          onClick={handleClose}
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-gray-100 text-gray-500 transition hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center px-6 pb-8 pt-10 text-center sm:px-10">
          <p className="text-sm font-bold text-[#f59e0b]" dir="rtl">أهلاً بك</p>
          <h2 className="mt-2 text-4xl font-extrabold text-gray-900" dir="rtl">مرحبا!</h2>
          
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm font-medium text-gray-600" dir="rtl">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#28326a]" />
              <span className="tnum mt-0.5">{currentTime}</span>
            </div>
            <div className="h-4 w-px bg-gray-300 hidden sm:block"></div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#28326a]" />
              <span className="mt-0.5">{currentDate}</span>
            </div>
          </div>

          <div className="my-10 w-full border-t border-gray-100"></div>

          <p 
            className="text-[26px] leading-[1.8] text-gray-900 sm:text-[30px]" 
            dir="rtl" 
            style={{ fontFamily: "'Amiri', serif" }}
          >
            بِسْمِ اللَّهِ تَوَكَّلْتُ عَلَى اللَّهِ، وَلَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ
          </p>

          <div className="mt-10 flex w-full justify-end">
            <button 
              onClick={handleClose}
              className="inline-flex items-center justify-center rounded-xl bg-[#111827] px-8 py-3 text-base font-bold text-white transition hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
              dir="rtl"
            >
              نبدأ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
