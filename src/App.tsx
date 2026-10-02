import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Dumbbell, Timer as TimerIcon, Calendar as CalendarIcon, Activity, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import Dexie, { Table } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';

// ==========================================
// 1. БАЗА ДАННЫХ
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

const initialExercises = [
  { category: 'МИНОТАВР', name: 'ГОБЛЕТ-присидання' }, { category: 'МИНОТАВР', name: 'ПРОТЯЖКА до подборіддя' }, { category: 'МИНОТАВР', name: 'МАХИ 2 руками' }, { category: 'МИНОТАВР', name: 'ТЯГА В НАКЛОНІ до поясу' }, { category: 'МИНОТАВР', name: 'СТАНОВА ТЯГА з гірею' },
  { category: 'НОГИ', name: 'ПРИСІДАННЯ з ЕСПАНДЕРОМ' },
  { category: 'ДРАБИНА з ГИРЕЮ', name: 'МАХИ 2 руками' }, { category: 'ДРАБИНА з ГИРЕЮ', name: 'ГОБЛЕТ-присидання' }, { category: 'ДРАБИНА з ГИРЕЮ', name: 'ВІДЖИМАННЯ' },
  { category: 'ТРАСТЕР', name: 'ТРАСТЕР з еспандером' },
  { category: 'БРУСИ', name: 'ВІДЖИМАННЯ на брусах' },
  { category: 'ДЕЛЬТИ', name: 'ПРОТЯЖКА до подборіддя еспандер' }, { category: 'ДЕЛЬТИ', name: 'ЖИМ ЕСПАНДЕРА над головою' }, { category: 'ДЕЛЬТИ', name: 'РОЗВЕДЕННЯ ЕСПАНДЕРА В СТОРОНИ' }, { category: 'ДЕЛЬТИ', name: 'ПІДНЯТТЯ ЕСПАНДЕРА з ротацією' }, { category: 'ДЕЛЬТИ', name: 'РОЗВЕДЕННЯ ЕСПАНДЕРА однією рукою' }, { category: 'ДЕЛЬТИ', name: 'РОЗВЕДЕННЯ ЕСПАНДЕРА перед собою' }, { category: 'ДЕЛЬТИ', name: 'ТЯГА В НАКЛОНІ на задню дельту' },
  { category: 'СПИНА', name: 'ПІДТЯГУВАННЯ' }, { category: 'СПИНА', name: 'ПІДТЯГУВАННЯ З ЕСПАНДЕРОМ' }, { category: 'СПИНА', name: 'ТЯГА В НАКЛОНІ еспандера зворотнім хватом' }, { category: 'СПИНА', name: 'ШРАГИ З ЕСПАНДЕРОМ' }, { category: 'СПИНА', name: 'ПРОТЯЖКА до подборіддя' }, { category: 'СПИНА', name: 'СТАНОВА ТЯГА з еспандером' }
];

const initialWorkouts = [
  { name: 'МИНОТАВР', exercises: ['ГОБЛЕТ-присидання', 'ПРОТЯЖКА до подборіддя', 'МАХИ 2 руками', 'ТЯГА В НАКЛОНІ до поясу', 'СТАНОВА ТЯГА з гірею'] },
  { name: 'НОГИ', exercises: ['ПРИСІДАННЯ з ЕСПАНДЕРОМ'] },
  { name: 'ДРАБИНА з ГИРЕЮ', exercises: ['МАХИ 2 руками', 'ГОБЛЕТ-присидання', 'ВІДЖИМАННЯ'] },
  { name: 'ТРАСТЕР', exercises: ['ТРАСТЕР з еспандером'] },
  { name: 'БРУСИ (драбина)', exercises: ['ВІДЖИМАННЯ на брусах'] },
  { name: 'БРУСИ (важко)', exercises: ['ВІДЖИМАННЯ на брусах'] },
  { name: 'ДЕЛЬТИ', exercises: ['ПРОТЯЖКА до подборіддя еспандер', 'ЖИМ ЕСПАНДЕРА над головою', 'РОЗВЕДЕННЯ ЕСПАНДЕРА В СТОРОНИ', 'ПІДНЯТТЯ ЕСПАНДЕРА з ротацією', 'РОЗВЕДЕННЯ ЕСПАНДЕРА однією рукою', 'РОЗВЕДЕННЯ ЕСПАНДЕРА перед собою', 'ТЯГА В НАКЛОНІ на задню дельту'] },
  { name: 'СПИНА', exercises: ['ПІДТЯГУВАННЯ', 'ПІДТЯГУВАННЯ З ЕСПАНДЕРОМ', 'ТЯГА В НАКЛОНІ еспандера зворотнім хватом', 'ШРАГИ З ЕСПАНДЕРОМ', 'ПРОТЯЖКА до подборіддя', 'СТАНОВА ТЯГА з еспандером'] }
];

// ==========================================
// 2. КАЛЕНДАРЬ (МЕСЯЦ + НЕДЕЛЯ)
// ==========================================
function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const scheduled = useLiveQuery(() => db.scheduled.toArray());
  const workouts = useLiveQuery(() => db.workouts.toArray());
  const [showAddModal, setShowAddModal] = useState<string | null>(null);

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

  const getMonthDays = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const weekDays = getWeekDays(currentDate);
  const monthDays = getMonthDays(currentDate);
  const todayStr = new Date().toISOString().split('T')[0];

  const handlePlanWorkout = async (workoutName: string) => {
    if (showAddModal) {
      await db.scheduled.add({ id: crypto.randomUUID(), date: showAddModal, workoutName, isCompleted: false });
      setShowAddModal(null);
    }
  };

  const changeMonth = (offset: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + offset);
    setCurrentDate(newDate);
  };

  return (
    <div className="p-4 pb-24">
      {/* Кнопка Сегодня */}
      <div className="flex justify-end mb-4">
        <button onClick={() => setCurrentDate(new Date())} className="bg-blue-100 text-blue-600 px-4 py-2 rounded-lg font-bold">Сьогодні</button>
      </div>

      {/* МЕСЯЦ */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex justify-between items-center mb-4">
          <button onClick={() => changeMonth(-1)} className="p-2"><ChevronLeft /></button>
          <h3 className="font-bold text-lg capitalize">
            {currentDate.toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' })}
          </h3>
          <button onClick={() => changeMonth(1)} className="p-2"><ChevronRight /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2 text-gray-500 font-bold">
          <div>Пн</div><div>Вт</div><div>Ср</div><div>Чт</div><div>Пт</div><div>Сб</div><div>Нд</div>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {/* Пустые ячейки для сдвига начала месяца */}
          {Array.from({ length: (monthDays[0].getDay() + 6) % 7 }).map((_, i) => <div key={`empty-${i}`} />)}
          
          {monthDays.map(day => {
            const dateStr = day.toISOString().split('T')[0];
            const hasWorkout = scheduled?.find(s => s.date === dateStr);
            const isToday = dateStr === todayStr;
            
            return (
              <div 
                key={dateStr}
                onClick={() => setCurrentDate(day)}
                className={`
                  aspect-square flex items-center justify-center rounded-lg text-sm cursor-pointer
                  ${hasWorkout ? 'bg-green-100 text-green-800 font-bold border border-green-300' : 'bg-gray-50 text-gray-700'}
                  ${isToday ? 'ring-2 ring-blue-500 font-bold' : ''}
                `}
              >
                {day.getDate()}
                {hasWorkout && <span className="absolute mt-5 text-[8px]">{hasWorkout.workoutName.charAt(0)}</span>}
              </div>
            );
          })}
        </div>
      </div>

      <h2 className="text-xl font-bold mb-4">План на тиждень</h2>

      {/* НЕДЕЛЯ */}
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
                <button onClick={() => setShowAddModal(dateStr)} className="text-blue-500 p-1 bg-blue-50 rounded-md"><Plus size={20} /></button>
              </div>

              {dayPlans.map(plan => (
                <div key={plan.id} className="mt-2 p-3 bg-gray-50 rounded-lg flex justify-between items-center border border-gray-100">
                  <span className="font-bold text-gray-800">{plan.workoutName}</span>
                  <button className="text-xs bg-green-500 text-white px-3 py-1 rounded-full font-bold">ВЫПОЛНИТЬ</button>
                </div>
              ))}
              {dayPlans.length === 0 && <div className="text-xs text-gray-400 italic">Немає тренувань</div>}
            </div>
          );
        })}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-[100] pb-20">
          <div className="bg-white w-full rounded-t-2xl p-4 max-h-[70vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Оберіть тренування</h3>
              <button onClick={() => setShowAddModal(null)} className="text-red-500 font-bold">Закрити</button>
            </div>
            <div className="space-y-2">
              {workouts?.map(w => (
                <button key={w.id} onClick={() => handlePlanWorkout(w.name)} className="w-full text-left p-4 bg-gray-50 rounded-xl font-bold border active:bg-gray-200">
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

// ==========================================
// 3. СПРАВОЧНИК УПРАЖНЕНИЙ
// ==========================================
function Exercises() {
  const exercises = useLiveQuery(() => db.exercises.toArray());
  const [search, setSearch] = useState('');
  const filtered = exercises?.filter(ex => ex.name.toLowerCase().includes(search.toLowerCase())) || [];

  return (
    <div className="p-4 pb-24">
      <h2 className="text-2xl font-bold mb-4">Вправи</h2>
      <input className="w-full p-3 mb-4 border rounded-lg shadow-sm" placeholder="Пошук..." value={search} onChange={e => setSearch(e.target.value)} />
      <div className="space-y-2">
        {filtered.map(ex => (
          <div key={ex.id} className="bg-white p-3 rounded-lg shadow-sm border-l-4 border-blue-500">
            <div className="text-xs text-gray-400 font-bold">{ex.category}</div>
            <div className="font-medium text-lg">{ex.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==========================================
// 4. ШАБЛОНЫ ТРЕНИРОВОК
// ==========================================
function Workouts() {
  const workouts = useLiveQuery(() => db.workouts.toArray());
  return (
    <div className="p-4 pb-24">
      <h2 className="text-2xl font-bold mb-4">Шаблони тренувань</h2>
      <div className="space-y-4">
        {workouts?.map(workout => (
          <div key={workout.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-xl text-blue-600 mb-2">{workout.name}</h3>
            <ul className="list-disc pl-5 space-y-1">
              {workout.exercises.map((exName, idx) => <li key={idx} className="text-gray-700 text-sm">{exName}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==========================================
// 5. ТАЙМЕРЫ
// ==========================================
function Timers() {
  const [mode, setMode] = useState<'TABATA' | 'FREE'>('TABATA');
  const audioCtx = useRef<AudioContext | null>(null);

  const [workTime, setWorkTime] = useState(20);
  const [restTime, setRestTime] = useState(10);
  const [rounds, setRounds] = useState(8);
  
  const [isRunning, setIsRunning] = useState(false);
  const [phase, setPhase] = useState<'WORK' | 'REST' | 'IDLE'>('IDLE');
  const [timeLeft, setTimeLeft] = useState(workTime);
  const [currentRound, setCurrentRound] = useState(1);

  const [freeTime, setFreeTime] = useState(0);
  const [freePhase, setFreePhase] = useState<'Розминка' | 'Основна' | 'Заминка' | 'Остановлен'>('Остановлен');

  const beep = (freq: number, duration: number) => {
    if (!audioCtx.current) return;
    const osc = audioCtx.current.createOscillator();
    osc.connect(audioCtx.current.destination);
    osc.frequency.value = freq;
    osc.start();
    osc.stop(audioCtx.current.currentTime + duration);
  };

  const initAudio = () => {
    if (!audioCtx.current) audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioCtx.current.resume();
  };

  useEffect(() => {
    let t: number;
    if (mode === 'TABATA' && isRunning && phase !== 'IDLE') {
      t = window.setInterval(() => {
        setTimeLeft(prev => {
          if (prev === 6) beep(800, 0.2); 
          if (prev <= 1) {
            if (phase === 'WORK') {
              if (currentRound >= rounds) { setIsRunning(false); setPhase('IDLE'); beep(400, 1); return workTime; }
              setPhase('REST'); beep(1200, 0.5); return restTime;
            } else {
              setPhase('WORK'); setCurrentRound(r => r + 1); beep(1200, 0.5); return workTime;
            }
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(t);
  }, [isRunning, phase, currentRound, mode, workTime, restTime, rounds]);

  useEffect(() => {
    let t: number;
    if (mode === 'FREE' && freePhase !== 'Остановлен') {
      t = window.setInterval(() => setFreeTime(prev => prev + 1), 1000);
    }
    return () => clearInterval(t);
  }, [freePhase, mode]);

  const toggleTabata = () => {
    initAudio();
    if (!isRunning && phase === 'IDLE') { setPhase('WORK'); setTimeLeft(workTime); setCurrentRound(1); }
    setIsRunning(!isRunning);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="p-4 pb-24">
      <div className="flex bg-gray-200 rounded-lg p-1 mb-6">
        <button className={`flex-1 py-2 font-bold rounded-md ${mode === 'TABATA' ? 'bg-white shadow' : 'text-gray-500'}`} onClick={() => setMode('TABATA')}>Табата</button>
        <button className={`flex-1 py-2 font-bold rounded-md ${mode === 'FREE' ? 'bg-white shadow' : 'text-gray-500'}`} onClick={() => setMode('FREE')}>Фактичний час</button>
      </div>

      {mode === 'TABATA' ? (
        <div className="flex flex-col items-center">
          {!isRunning && phase === 'IDLE' && (
            <div className="w-full bg-white p-4 rounded-xl shadow-sm mb-6 flex justify-between gap-2">
              <div className="text-center"><div className="text-xs text-gray-500">Робота</div><input type="number" value={workTime} onChange={e => setWorkTime(Number(e.target.value))} className="w-full text-xl font-bold text-center border-b-2" /></div>
              <div className="text-center"><div className="text-xs text-gray-500">Відпочинок</div><input type="number" value={restTime} onChange={e => setRestTime(Number(e.target.value))} className="w-full text-xl font-bold text-center border-b-2" /></div>
              <div className="text-center"><div className="text-xs text-gray-500">Цикли</div><input type="number" value={rounds} onChange={e => setRounds(Number(e.target.value))} className="w-full text-xl font-bold text-center border-b-2" /></div>
            </div>
          )}
          <div className={`w-64 h-64 rounded-full flex flex-col items-center justify-center text-white shadow-lg ${phase === 'WORK' ? 'bg-red-500' : phase === 'REST' ? 'bg-green-500' : 'bg-gray-800'}`}>
            <span className="text-2xl font-bold">{phase === 'WORK' ? 'РОБОТА' : phase === 'REST' ? 'ВІДПОЧИНОК' : 'ГОТОВИЙ'}</span>
            <span className="text-7xl font-mono mt-2">{formatTime(timeLeft)}</span>
            {phase !== 'IDLE' && <span className="text-lg mt-2">Цикл {currentRound}/{rounds}</span>}
          </div>
          <button onClick={toggleTabata} className="mt-10 bg-blue-600 text-white px-8 py-4 rounded-xl text-2xl font-bold w-full shadow-lg">{isRunning ? 'ПАУЗА' : phase === 'IDLE' ? 'СТАРТ' : 'ПРОДОВЖИТИ'}</button>
          {phase !== 'IDLE' && !isRunning && <button onClick={() => { setPhase('IDLE'); setIsRunning(false); }} className="mt-4 bg-red-100 text-red-600 px-8 py-3 rounded-xl font-bold w-full">Скинути</button>}
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <div className="text-6xl font-mono my-8">{formatTime(freeTime)}</div>
          <div className="text-xl font-bold mb-8 text-blue-600">{freePhase}</div>
          <div className="grid grid-cols-1 gap-4 w-full">
            <button onClick={() => { initAudio(); setFreePhase('Розминка'); }} className="bg-yellow-400 text-black py-4 rounded-xl font-bold shadow">Почати Розминку</button>
            <button onClick={() => { initAudio(); setFreePhase('Основна'); }} className="bg-red-500 text-white py-4 rounded-xl font-bold shadow">Почати Основну</button>
            <button onClick={() => { initAudio(); setFreePhase('Заминка'); }} className="bg-green-500 text-white py-4 rounded-xl font-bold shadow">Почати Заминку</button>
            <button onClick={() => { initAudio(); setFreePhase('Остановлен'); setFreeTime(0); }} className="bg-gray-800 text-white py-4 rounded-xl font-bold mt-4">Завершити</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 6. НАВИГАЦИЯ
// ==========================================
export default function App() {
  useEffect(() => {
    const initDb = async () => {
      // Чтобы новые данные загрузились, мы проверяем, не нужно ли очистить старые
      const exCount = await db.exercises.count();
      const wCount = await db.workouts.count();
      
      if (exCount < initialExercises.length) {
        await db.exercises.clear();
        await db.exercises.bulkAdd(initialExercises.map(ex => ({ id: crypto.randomUUID(), ...ex })));
      }
      if (wCount < initialWorkouts.length) {
        await db.workouts.clear();
        await db.workouts.bulkAdd(initialWorkouts.map(w => ({ id: crypto.randomUUID(), ...w })));
      }
    };
    initDb();
  }, []);

  return (
    <BrowserRouter basename="/w_jornal">
      <div className="min-h-screen bg-gray-50 font-sans">
        <Routes>
          <Route path="/" element={<CalendarView />} />
          <Route path="/workouts" element={<Workouts />} />
          <Route path="/exercises" element={<Exercises />} />
          <Route path="/timer" element={<Timers />} />
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
