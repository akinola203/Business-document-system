import React from 'react';
import { Outlet } from 'react-router-dom';
import { TopPillNavbar } from './TopPillNavbar';

export const AppShell: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F4F5F9] p-4 md:p-6 lg:p-7 flex flex-col gap-5">
      {/* 1. Floating Top Navigation Pill */}
      <TopPillNavbar />

      {/* 2. Framed Crisp White Inner Application Shell */}
      <main className="w-full bg-white rounded-[32px] p-6 md:p-8 shadow-sm border border-slate-200/70 min-h-[calc(100vh-130px)] flex flex-col">
        <Outlet />
      </main>
    </div>
  );
};
