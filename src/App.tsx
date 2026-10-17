import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { Dumbbell, Timer as TimerIcon, Calendar as CalendarIcon, Activity, Settings } from 'lucide-react';
import { db, initialExercises, initialWorkouts, generateId } from './db';
import { TimerProvider } from './TimerContext';
import { CalendarView, Workouts, Exercises, Timers, DataSync } from './pages';

export default function App() {
  useEffect(() => {
    document.title = "Щоденник Тренувань";
    document.documentElement.lang = "uk";
    
    const initDb = async () => {
      const exCount = await db.exercises.count();
      if (exCount === 0) {
        const insertedExercises = initialExercises.map(ex => ({ id: generateId(), ...ex }));
        await db.exercises.bulkAdd(insertedExercises);
        const workoutsToInsert = initialWorkouts.map(w => {
          const items = w.exercises.map(exName => { const foundEx = insertedExercises.find(e => e.name === exName); return { exerciseId: foundEx ? foundEx.id : '', weight: '', band: '', reps: '', note: '' }; }).filter(item => item.exerciseId !== '');
          return { id: generateId(), name: w.name, muscle: w.muscle, items, note: '' };
        });
        await db.workouts.bulkAdd(workoutsToInsert);
      }
    };
    initDb();
  }, []);

  return (
    <BrowserRouter basename="/w_jornal">
      <TimerProvider>
        <div className="min-h-screen bg-gray-50 font-sans pb-20">
          <Routes>
            <Route path="/" element={<CalendarView />} />
            <Route path="/workouts" element={<Workouts />} />
            <Route path="/exercises" element={<Exercises />} />
            <Route path="/timer" element={<Timers />} />
            <Route path="/data" element={<DataSync />} />
          </Routes>
          <nav className="fixed bottom-0 w-full bg-white border-t flex justify-between px-2 py-3 pb-6 shadow-[0_-5px_15px_-10px_rgba(0,0,0,0.1)] z-50">
            <NavLink to="/" className={({isActive}) => `flex flex-col items-center w-1/5 transition-colors ${isActive ? 'text-blue-600' : 'text-gray-400'}`}><CalendarIcon size={22} /><span className="text-[9px] mt-1 font-bold uppercase">План</span></NavLink>
            <NavLink to="/workouts" className={({isActive}) => `flex flex-col items-center w-1/5 transition-colors ${isActive ? 'text-blue-600' : 'text-gray-400'}`}><Activity size={22} /><span className="text-[9px] mt-1 font-bold uppercase">Тренування</span></NavLink>
            <NavLink to="/exercises" className={({isActive}) => `flex flex-col items-center w-1/5 transition-colors ${isActive ? 'text-blue-600' : 'text-gray-400'}`}><Dumbbell size={22} /><span className="text-[9px] mt-1 font-bold uppercase">Вправи</span></NavLink>
            <NavLink to="/timer" className={({isActive}) => `flex flex-col items-center w-1/5 transition-colors ${isActive ? 'text-blue-600' : 'text-gray-400'}`}><TimerIcon size={22} /><span className="text-[9px] mt-1 font-bold uppercase">Таймер</span></NavLink>
            <NavLink to="/data" className={({isActive}) => `flex flex-col items-center w-1/5 transition-colors ${isActive ? 'text-blue-600' : 'text-gray-400'}`}><Settings size={22} /><span className="text-[9px] mt-1 font-bold uppercase">Дані</span></NavLink>
          </nav>
        </div>
      </TimerProvider>
    </BrowserRouter>
  );
}