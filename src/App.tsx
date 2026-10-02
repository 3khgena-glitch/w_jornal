import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Dumbbell, Timer as TimerIcon, Calendar, Activity } from 'lucide-react';
import Dexie, { Table } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';

// ==========================================
// 1. БАЗА ДАННЫХ И АВТОЗАПОЛНЕНИЕ
// ==========================================
export interface Exercise { id: string; name: string; category: string; }
export class WorkoutDB extends Dexie {
  exercises!: Table<Exercise, string>;
  constructor() {
    super('WJornalLocalDB');
    this.version(2).stores({ exercises: 'id, name, category' });
  }
}
export const db = new WorkoutDB();

// Твоя база из ТЗ
const initialExercises = [
  { category: 'НОГИ', name: 'ГОБЛЕТ-присидання' },
  { category: 'НОГИ', name: 'ПРИСІДАННЯ з ЕСПАНДЕРОМ' },
  { category: 'ДРАБИНА з ГИРЕЮ', name: 'МАХИ 2 руками' },
  { category: 'ДРАБИНА з ГИРЕЮ', name: 'ГОБЛЕТ-присидання' },
  { category: 'ДРАБИНА з ГИРЕЮ', name: 'ВІДЖИМАННЯ' },
  { category: 'ТРАСТЕР', name: 'ТРАСТЕР з еспандером' },
  { category: 'БРУСИ', name: 'ВІДЖИМАННЯ на брусах' },
  { category: 'ДЕЛЬТИ', name: 'ПРОТЯЖКА до подборіддя еспандер' },
  { category: 'ДЕЛЬТИ', name: 'ЖИМ ЕСПАНДЕРА над головою' },
  { category: 'ДЕЛЬТИ', name: 'РОЗВЕДЕННЯ ЕСПАНДЕРА В СТОРОНИ' },
  { category: 'ДЕЛЬТИ', name: 'ПІДНЯТТЯ ЕСПАНДЕРА з ротацією' },
  { category: 'ДЕЛЬТИ', name: 'РОЗВЕДЕННЯ ЕСПАНДЕРА однією рукою' },
  { category: 'ДЕЛЬТИ', name: 'РОЗВЕДЕННЯ ЕСПАНДЕРА перед собою' },
  { category: 'ДЕЛЬТИ', name: 'ТЯГА В НАКЛОНІ на задню дельту' },
  { category: 'СПИНА', name: 'ПІДТЯГУВАННЯ' },
  { category: 'СПИНА', name: 'ПІДТЯГУВАННЯ З ЕСПАНДЕРОМ' },
  { category: 'СПИНА', name: 'ТЯГА В НАКЛОНІ еспандера зворотнім хватом' },
  { category: 'СПИНА', name: 'ШРАГИ З ЕСПАНДЕРОМ' },
  { category: 'СПИНА', name: 'ПРОТЯЖКА до подборіддя' },
  { category: 'СПИНА', name: 'СТАНОВА ТЯГА з еспандером' },
  { category: 'МИНОТАВР', name: 'ПРОТЯЖКА до подборіддя' },
  { category: 'МИНОТАВР', name: 'МАХИ 2 руками' },
  { category: 'МИНОТАВР', name: 'ТЯГА В НАКЛОНІ до поясу' },
  { category: 'МИНОТАВР', name: 'СТАНОВА ТЯГА з гірею' }
];

// ==========================================
// 2. СПРАВОЧНИК УПРАЖНЕНИЙ
// ==========================================
function Exercises() {
  const exercises = useLiveQuery(() => db.exercises.toArray());
  const [search, setSearch] = useState('');

  // Заполняем базу при первом заходе, если она пустая
  useEffect(() => {
    db.exercises.count().then(count => {
      if (count === 0) {
        const toAdd = initialExercises.map(ex => ({ id: crypto.randomUUID(), ...ex }));
        db.exercises.bulkAdd(toAdd);
      }
    });
  }, []);

  const filtered = exercises?.filter(ex => ex.name.toLowerCase().includes(search.toLowerCase())) || [];

  return (
    <div className="p-4 pb-24">
      <h2 className="text-2xl font-bold mb-4">Справочник вправ</h2>
      <input 
        className="w-full p-3 mb-4 border rounded-lg shadow-sm" 
        placeholder="Пошук (фільтр по літерам)..." 
        value={search} 
        onChange={e => setSearch(e.target.value)} 
      />
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
// 3. ТАЙМЕРЫ (ТАБАТА + ФАКТИЧЕСКОЕ ВРЕМЯ)
// ==========================================
function Timers() {
  const [mode, setMode] = useState<'TABATA' | 'FREE'>('TABATA');
  const audioCtx = useRef<AudioContext | null>(null);

  // Настройки Табаты
  const [workTime, setWorkTime] = useState(20);
  const [restTime, setRestTime] = useState(10);
  const [rounds, setRounds] = useState(8);
  
  // Состояние Табаты
  const [isRunning, setIsRunning] = useState(false);
  const [phase, setPhase] = useState<'WORK' | 'REST' | 'IDLE'>('IDLE');
  const [timeLeft, setTimeLeft] = useState(workTime);
  const [currentRound, setCurrentRound] = useState(1);

  // Состояние Свободной тренировки
  const [freeTime, setFreeTime] = useState(0);
  const [freePhase, setFreePhase] = useState<'Разминка' | 'Основная' | 'Заминка' | 'Остановлен'>('Остановлен');

  // Звуковой генератор (надежнее файлов для iOS)
  const beep = (freq: number, duration: number) => {
    if (!audioCtx.current) return;
    const osc = audioCtx.current.createOscillator();
    osc.connect(audioCtx.current.destination);
    osc.frequency.value = freq;
    osc.start();
    osc.stop(audioCtx.current.currentTime + duration);
  };

  const initAudio = () => {
    if (!audioCtx.current) {
      audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    audioCtx.current.resume();
  };

  // Логика Табаты
  useEffect(() => {
    let t: number;
    if (mode === 'TABATA' && isRunning && phase !== 'IDLE') {
      t = window.setInterval(() => {
        setTimeLeft(prev => {
          if (prev === 6) beep(800, 0.2); // Писк за 5 секунд до конца
          if (prev <= 1) {
            // Переключение фаз
            if (phase === 'WORK') {
              if (currentRound >= rounds) {
                setIsRunning(false);
                setPhase('IDLE');
                beep(400, 1); // Конец всей Табаты
                return workTime;
              }
              setPhase('REST');
              beep(1200, 0.5); // Начало отдыха
              return restTime;
            } else {
              setPhase('WORK');
              setCurrentRound(r => r + 1);
              beep(1200, 0.5); // Начало работы
              return workTime;
            }
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(t);
  }, [isRunning, phase, currentRound, mode, workTime, restTime, rounds]);

  // Логика секундомера свободной тренировки
  useEffect(() => {
    let t: number;
    if (mode === 'FREE' && freePhase !== 'Остановлен') {
      t = window.setInterval(() => setFreeTime(prev => prev + 1), 1000);
    }
    return () => clearInterval(t);
  }, [freePhase, mode]);

  const toggleTabata = () => {
    initAudio();
    if (!isRunning) {
      setPhase('WORK');
      setTimeLeft(workTime);
      setCurrentRound(1);
    }
    setIsRunning(!isRunning);
  };

  const setFreeWorkoutPhase = (newPhase: 'Разминка' | 'Основная' | 'Заминка' | 'Остановлен') => {
    initAudio();
    setFreePhase(newPhase);
    if (newPhase === 'Остановлен') setFreeTime(0);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="p-4 pb-24">
      {/* Переключатель режимов */}
      <div className="flex bg-gray-200 rounded-lg p-1 mb-6">
        <button className={`flex-1 py-2 font-bold rounded-md ${mode === 'TABATA' ? 'bg-white shadow' : 'text-gray-500'}`} onClick={() => setMode('TABATA')}>Табата</button>
        <button className={`flex-1 py-2 font-bold rounded-md ${mode === 'FREE' ? 'bg-white shadow' : 'text-gray-500'}`} onClick={() => setMode('FREE')}>Фактичний час</button>
      </div>

      {mode === 'TABATA' ? (
        <div className="flex flex-col items-center">
          {!isRunning && phase === 'IDLE' && (
            <div className="w-full bg-white p-4 rounded-xl shadow-sm mb-6 flex justify-between gap-2">
              <div className="text-center">
                <div className="text-xs text-gray-500">Робота (сек)</div>
                <input type="number" value={workTime} onChange={e => setWorkTime(Number(e.target.value))} className="w-full text-xl font-bold text-center border-b-2 outline-none py-1" />
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500">Відпочинок (сек)</div>
                <input type="number" value={restTime} onChange={e => setRestTime(Number(e.target.value))} className="w-full text-xl font-bold text-center border-b-2 outline-none py-1" />
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500">Цикли</div>
                <input type="number" value={rounds} onChange={e => setRounds(Number(e.target.value))} className="w-full text-xl font-bold text-center border-b-2 outline-none py-1" />
              </div>
            </div>
          )}

          <div className={`w-64 h-64 rounded-full flex flex-col items-center justify-center text-white shadow-lg transition-colors duration-300
            ${phase === 'WORK' ? 'bg-red-500' : phase === 'REST' ? 'bg-green-500' : 'bg-gray-800'}`}>
            <span className="text-2xl font-bold">{phase === 'WORK' ? 'РОБОТА' : phase === 'REST' ? 'ВІДПОЧИНОК' : 'ГОТОВИЙ'}</span>
            <span className="text-7xl font-mono mt-2">{formatTime(timeLeft)}</span>
            {phase !== 'IDLE' && <span className="text-lg mt-2">Цикл {currentRound}/{rounds}</span>}
          </div>

          <button onClick={toggleTabata} className="mt-10 bg-blue-600 text-white px-8 py-4 rounded-xl text-2xl font-bold w-full shadow-lg">
            {isRunning ? 'ПАУЗА' : phase === 'IDLE' ? 'СТАРТ' : 'ПРОДОВЖИТИ'}
          </button>
          
          {phase !== 'IDLE' && !isRunning && (
            <button onClick={() => { setPhase('IDLE'); setIsRunning(false); }} className="mt-4 bg-red-100 text-red-600 px-8 py-3 rounded-xl font-bold w-full">Скинути</button>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <div className="text-6xl font-mono my-8">{formatTime(freeTime)}</div>
          <div className="text-xl font-bold mb-8 text-blue-600">{freePhase}</div>
          
          <div className="grid grid-cols-1 gap-4 w-full">
            <button onClick={() => setFreeWorkoutPhase('Разминка')} className="bg-yellow-400 text-black py-4 rounded-xl font-bold text-lg shadow">Почати Розминку</button>
            <button onClick={() => setFreeWorkoutPhase('Основная')} className="bg-red-500 text-white py-4 rounded-xl font-bold text-lg shadow">Почати Основну</button>
            <button onClick={() => setFreeWorkoutPhase('Заминка')} className="bg-green-500 text-white py-4 rounded-xl font-bold text-lg shadow">Почати Заминку</button>
            <button onClick={() => setFreeWorkoutPhase('Остановлен')} className="bg-gray-800 text-white py-4 rounded-xl font-bold text-lg mt-4">Завершити</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 4. ГЛАВНОЕ ПРИЛОЖЕНИЕ (НАВИГАЦИЯ)
// ==========================================
export default function App() {
  return (
    <BrowserRouter basename="/w_jornal">
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/" element={<Exercises />} />
          <Route path="/timer" element={<Timers />} />
          <Route path="/workouts" element={<div className="p-8 text-center text-gray-500 font-bold">Справочник тренировок (Структура готова, UI в разработке)</div>} />
          <Route path="/calendar" element={<div className="p-8 text-center text-gray-500 font-bold">Календарь (UI в разработке)</div>} />
        </Routes>
        
        <nav className="fixed bottom-0 w-full bg-white border-t flex justify-around p-3 pb-6 shadow-[0_-5px_15px_-10px_rgba(0,0,0,0.1)] z-50">
          <Link to="/" className="flex flex-col items-center text-gray-600"><Dumbbell size={24} /><span className="text-[10px] mt-1 font-medium">Вправи</span></Link>
          <Link to="/workouts" className="flex flex-col items-center text-gray-600"><Activity size={24} /><span className="text-[10px] mt-1 font-medium">Тренування</span></Link>
          <Link to="/timer" className="flex flex-col items-center text-gray-600"><TimerIcon size={24} /><span className="text-[10px] mt-1 font-medium">Таймер</span></Link>
          <Link to="/calendar" className="flex flex-col items-center text-gray-600"><Calendar size={24} /><span className="text-[10px] mt-1 font-medium">План</span></Link>
        </nav>
      </div>
    </BrowserRouter>
  );
}
