import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Dumbbell, Timer as TimerIcon, Calendar } from 'lucide-react';
import Dexie, { Table } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';

// БАЗА ДАННЫХ
export interface Exercise { id: string; name: string; }
export class WorkoutDB extends Dexie {
  exercises!: Table<Exercise, string>;
  constructor() {
    super('WJornalLocalDB');
    this.version(1).stores({ exercises: 'id, name' });
  }
}
export const db = new WorkoutDB();

// СТРАНИЦА УПРАЖНЕНИЙ
function Exercises() {
  const [name, setName] = useState('');
  const exercises = useLiveQuery(() => db.exercises.toArray());
  const add = async () => {
    if (!name.trim()) return;
    await db.exercises.add({ id: crypto.randomUUID(), name: name.trim() });
    setName('');
  };
  return (
    <div className="p-4 pb-20">
      <h2 className="text-2xl font-bold mb-4">Справочник</h2>
      <div className="flex gap-2 mb-4">
        <input className="flex-1 p-3 border rounded-lg shadow-sm" placeholder="Новое упражнение..." value={name} onChange={e => setName(e.target.value)} />
        <button className="bg-blue-600 text-white font-bold px-4 rounded-lg shadow-sm" onClick={add}>Добавить</button>
      </div>
      <div className="space-y-2">
        {exercises?.map(ex => (
          <div key={ex.id} className="bg-white p-4 rounded-lg shadow-sm flex justify-between">
            <span className="font-medium">{ex.name}</span>
            <button onClick={() => db.exercises.delete(ex.id)} className="text-red-500 font-bold">Удалить</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ТАЙМЕР
function Timer() {
  const [isRunning, setIsRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(20);
  const audioCtx = useRef<AudioContext | null>(null);

  const toggle = () => {
    if (!audioCtx.current) audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioCtx.current.resume();
    setIsRunning(!isRunning);
  };

  useEffect(() => {
    let t: number;
    if (isRunning && timeLeft > 0) {
      t = window.setInterval(() => setTimeLeft(x => x - 1), 1000);
    }
    return () => clearInterval(t);
  }, [isRunning, timeLeft]);

  return (
    <div className="p-4 flex flex-col items-center justify-center min-h-[70vh]">
      <div className="w-64 h-64 rounded-full flex items-center justify-center bg-red-500 text-white text-7xl font-bold shadow-lg">
        {timeLeft}
      </div>
      <button onClick={toggle} className="mt-10 bg-blue-600 text-white px-8 py-4 rounded-xl text-2xl font-bold w-full shadow-lg">
        {isRunning ? 'ПАУЗА' : 'СТАРТ'}
      </button>
    </div>
  );
}

// ГЛАВНОЕ ПРИЛОЖЕНИЕ (НАВИГАЦИЯ)
export default function App() {
  return (
    <BrowserRouter basename="/w_jornal">
      <div className="min-h-screen">
        <Routes>
          <Route path="/" element={<Exercises />} />
          <Route path="/timer" element={<Timer />} />
          <Route path="/calendar" element={<div className="p-8 text-center text-gray-500 font-bold">Календарь (Раздел в разработке)</div>} />
        </Routes>
        <nav className="fixed bottom-0 w-full bg-white border-t flex justify-around p-4 pb-8 shadow-lg">
          <Link to="/" className="flex flex-col items-center text-gray-700"><Dumbbell size={24} /><span className="text-xs mt-1 font-medium">База</span></Link>
          <Link to="/timer" className="flex flex-col items-center text-gray-700"><TimerIcon size={24} /><span className="text-xs mt-1 font-medium">Таймер</span></Link>
          <Link to="/calendar" className="flex flex-col items-center text-gray-700"><Calendar size={24} /><span className="text-xs mt-1 font-medium">План</span></Link>
        </nav>
      </div>
    </BrowserRouter>
  );
}
