import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Dumbbell, Timer as TimerIcon, Calendar as CalendarIcon, Activity, Plus } from 'lucide-react';
import Dexie, { Table } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';

// ==========================================
// 1. БАЗА ДАННЫХ (Обновлена до версии 4)
// ==========================================
export interface Exercise { id: string; name: string; category: string; }
export interface Workout { id: string; name: string; exercises: string[]; }
export interface Scheduled { id: string; date: string; workoutName: string; isCompleted: boolean; }
export interface History { id: string; date: string; workoutName: string; }

export class WorkoutJournalDB extends Dexie {
  exercises!: Table<Exercise, string>;
  workouts!: Table<Workout, string>;
  scheduled!: Table<Scheduled, string>;
  history!: Table<History, string>;
  
  constructor() {
    super('WJornalLocalDB');
    this.version(4).stores({ 
      exercises: 'id, name, category',
      workouts: 'id, name',
      scheduled: 'id, date',
      history: 'id, date'
    });
  }
}
export const db = new WorkoutJournalDB();

// (Здесь остаются твои массивы initialExercises и initialWorkouts из предыдущего кода)
const initialExercises = [
  { category: 'МИНОТАВР', name: 'ГОБЛЕТ-присидання' },
  { category: 'МИНОТАВР', name: 'ПРОТЯЖКА до подборіддя' },
  { category: 'НОГИ', name: 'ПРИСІДАННЯ з ЕСПАНДЕРОМ' },
  // ... сокращено для примера, вставь свои полные массивы из прошлого шага
];
const initialWorkouts = [
  { name: 'МИНОТАВР', exercises: ['ГОБЛЕТ-присидання', 'ПРОТЯЖКА до подборіддя'] },
  { name: 'НОГИ', exercises: ['ПРИСІДАННЯ з ЕСПАНДЕРОМ'] },
  // ... вставь свои полные массивы
];

// ==========================================
// 2. КАЛЕНДАРЬ (НЕДЕЛЯ)
// ==========================================
function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const scheduled = useLiveQuery(() => db.scheduled.toArray());
  const workouts = useLiveQuery(() => db.workouts.toArray());
  const [showAddModal, setShowAddModal] = useState<string | null>(null);

  // Получаем дни текущей недели (Пн-Вс)
  const getWeekDays = (date: Date) => {
    const days = [];
    const curr = new Date(date);
    const first = curr.getDate() - curr.getDay() + (curr.getDay() === 0 ? -6 : 1); 
    const firstDay = new Date(curr.setDate(first));
    
    for (let i = 0; i < 7; i++) {
      const d = new Date(firstDay);
      d.setDate(firstDay.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const weekDays = getWeekDays(currentDate);
  const todayStr = new Date().toISOString().split('T')[0];

  const handlePlanWorkout = async (workoutName: string) => {
    if (showAddModal) {
      await db.scheduled.add({
        id: crypto.randomUUID(),
        date: showAddModal,
        workoutName: workoutName,
        isCompleted: false
      });
      setShowAddModal(null);
    }
  };

  return (
    <div className="p-4 pb-24">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">План на тиждень</h2>
        <button 
          onClick={() => setCurrentDate(new Date())}
          className="bg-blue-100 text-blue-600 px-3 py-1 rounded-lg font-bold text-sm"
        >
          Сьогодні
        </button>
      </div>

      <div className="space-y-4">
        {weekDays.map(day => {
          const dateStr = day.toISOString().split('T')[0];
          const isToday = dateStr === todayStr;
          const dayPlans = scheduled?.filter(s => s.date === dateStr) || [];
          const dayName = day.toLocaleDateString('uk-UA', { weekday: 'short' });

          return (
            <div key={dateStr} className={`bg-white rounded-xl shadow-sm border-l-4 p-4 ${isToday ? 'border-blue-500 ring-1 ring-blue-100' : 'border-gray-200'}`}>
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>{day.getDate()}</span>
                  <span className="text-sm text-gray-400 capitalize">{dayName}</span>
                </div>
                <button onClick={() => setShowAddModal(dateStr)} className="text-blue-500 p-1 bg-blue-50 rounded-md">
                  <Plus size={20} />
                </button>
              </div>

              {dayPlans.map(plan => (
                <div key={plan.id} className="mt-2 p-3 bg-gray-50 rounded-lg flex justify-between items-center border border-gray-100">
                  <span className="font-bold text-gray-800">{plan.workoutName}</span>
                  <button className="text-xs bg-green-500 text-white px-3 py-1 rounded-full font-bold">
                    ВЫПОЛНИТЬ
                  </button>
                </div>
              ))}
              {dayPlans.length === 0 && (
                <div className="text-xs text-gray-400 italic">Немає тренувань</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Модальное окно выбора тренировки */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-[100] pb-20">
          <div className="bg-white w-full rounded-t-2xl p-4 max-h-[70vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Оберіть тренування</h3>
              <button onClick={() => setShowAddModal(null)} className="text-red-500 font-bold">Закрити</button>
            </div>
            <div className="space-y-2">
              {workouts?.map(w => (
                <button 
                  key={w.id} 
                  onClick={() => handlePlanWorkout(w.name)}
                  className="w-full text-left p-4 bg-gray-50 rounded-xl font-bold border active:bg-gray-200"
                >
                  {w.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ... (Оставь функции Exercises, Workouts и Timers без изменений из прошлого ответа)

// ==========================================
// НАВИГАЦИЯ
// ==========================================
export default function App() {
  useEffect(() => {
    const initDb = async () => {
      if (await db.exercises.count() === 0) {
        await db.exercises.bulkAdd(initialExercises.map(ex => ({ id: crypto.randomUUID(), ...ex })));
      }
      if (await db.workouts.count() === 0) {
        await db.workouts.bulkAdd(initialWorkouts.map(w => ({ id: crypto.randomUUID(), ...w })));
      }
    };
    initDb();
  }, []);

  return (
    <BrowserRouter basename="/w_jornal">
      <div className="min-h-screen bg-gray-50 font-sans">
        <Routes>
          <Route path="/" element={<CalendarView />} /> {/* Сделал календарь главной */}
          <Route path="/exercises" element={<div>Довідник вправ (перенеси сюди компонент Exercises)</div>} />
          <Route path="/workouts" element={<div>Шаблони (перенеси сюди Workouts)</div>} />
          <Route path="/timer" element={<div>Таймери (перенеси сюди Timers)</div>} />
        </Routes>
        
        <nav className="fixed bottom-0 w-full bg-white border-t flex justify-around p-3 pb-6 shadow-[0_-5px_15px_-10px_rgba(0,0,0,0.1)] z-50">
          <Link to="/" className="flex flex-col items-center text-gray-600"><CalendarIcon size={24} /><span className="text-[10px] mt-1 font-medium">План</span></Link>
          <Link to="/workouts" className="flex flex-col items-center text-gray-600"><Activity size={24} /><span className="text-[10px] mt-1 font-medium">Тренування</span></Link>
          <Link to="/exercises" className="flex flex-col items-center text-gray-600"><Dumbbell size={24} /><span className="text-[10px] mt-1 font-medium">Вправи</span></Link>
          <Link to="/timer" className="flex flex-col items-center text-gray-600"><TimerIcon size={24} /><span className="text-[10px] mt-1 font-medium">Таймер</span></Link>
        </nav>
      </div>
    </BrowserRouter>
  );
}
