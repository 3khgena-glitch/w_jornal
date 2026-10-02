import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Dumbbell, Timer as TimerIcon, Calendar as CalendarIcon, Activity, Plus, Settings, Trash2, Edit2, Save, X, ChevronLeft, ChevronRight } from 'lucide-react';
import Dexie, { Table } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';

// ==========================================
// 1. БАЗА ДАНИХ (Оновлена структура)
// ==========================================
export interface Exercise { id: string; name: string; category: string; }
export interface WorkoutItem { exerciseId: string; weight: string; band: string; reps: string; note: string; }
export interface Workout { id: string; name: string; items: WorkoutItem[]; note: string; }
export interface Scheduled { id: string; date: string; workoutId: string; isCompleted: boolean; }
export interface History { id: string; date: string; workoutName: string; duration: number; items: WorkoutItem[]; }

export class WorkoutJournalDB extends Dexie {
  exercises!: Table<Exercise, string>;
  workouts!: Table<Workout, string>;
  scheduled!: Table<Scheduled, string>;
  history!: Table<History, string>;
  
  constructor() {
    super('WJornalDB_v6');
    this.version(1).stores({ 
      exercises: 'id, name, category',
      workouts: 'id, name',
      scheduled: 'id, date',
      history: 'id, date'
    });
  }
}
export const db = new WorkoutJournalDB();

// Твої початкові дані
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
// 2. КАЛЕНДАР (МІСЯЦЬ + ТИЖДЕНЬ)
// ==========================================
function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'week' | 'month'>('week');
  const scheduled = useLiveQuery(() => db.scheduled.toArray());
  const workouts = useLiveQuery(() => db.workouts.toArray());
  const [planModalDate, setPlanModalDate] = useState<string | null>(null);

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

  const getMonthDays = (year: number, month: number) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    return days;
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const handlePlan = async (workoutId: string) => {
    if (planModalDate) {
      await db.scheduled.add({ id: crypto.randomUUID(), date: planModalDate, workoutId, isCompleted: false });
      setPlanModalDate(null);
    }
  };

  return (
    <div className="p-4 pb-24">
      <div className="flex justify-between items-center mb-4">
        <div className="flex bg-gray-200 rounded-lg p-1">
          <button className={`px-4 py-1 rounded-md text-sm font-bold ${view === 'week' ? 'bg-white shadow' : ''}`} onClick={() => setView('week')}>Тиждень</button>
          <button className={`px-4 py-1 rounded-md text-sm font-bold ${view === 'month' ? 'bg-white shadow' : ''}`} onClick={() => setView('month')}>Місяць</button>
        </div>
        <button onClick={() => setCurrentDate(new Date())} className="text-blue-600 font-bold text-sm bg-blue-50 px-3 py-1 rounded">Сьогодні</button>
      </div>

      {view === 'month' && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex gap-2 mb-4">
            <select 
              value={currentDate.getMonth()} 
              onChange={e => { const d = new Date(currentDate); d.setMonth(Number(e.target.value)); setCurrentDate(d); }}
              className="p-2 border rounded font-bold bg-gray-50 flex-1"
            >
              {Array.from({length: 12}).map((_, i) => <option key={i} value={i}>{new Date(2000, i).toLocaleDateString('uk-UA', {month: 'long'})}</option>)}
            </select>
            <select 
              value={currentDate.getFullYear()} 
              onChange={e => { const d = new Date(currentDate); d.setFullYear(Number(e.target.value)); setCurrentDate(d); }}
              className="p-2 border rounded font-bold bg-gray-50 w-24"
            >
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2 text-gray-500 font-bold">
            <div>Пн</div><div>Вт</div><div>Ср</div><div>Чт</div><div>Пт</div><div>Сб</div><div>Нд</div>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: (new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay() + 6) % 7 }).map((_, i) => <div key={`e-${i}`} />)}
            {getMonthDays(currentDate.getFullYear(), currentDate.getMonth()).map(day => {
              const dStr = day.toISOString().split('T')[0];
              const plans = scheduled?.filter(s => s.date === dStr) || [];
              return (
                <div key={dStr} onClick={() => setPlanModalDate(dStr)} className={`aspect-square flex flex-col items-center justify-center rounded-md text-sm cursor-pointer border ${plans.length > 0 ? 'bg-green-100 text-green-800 font-bold' : 'bg-gray-50'} ${dStr === todayStr ? 'ring-2 ring-blue-500' : ''}`}>
                  <span>{day.getDate()}</span>
                  {plans.length > 0 && <div className="w-1.5 h-1.5 rounded-full bg-green-600 mt-1"></div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === 'week' && (
        <div className="space-y-3">
          <div className="font-bold text-lg mb-2 capitalize">{currentDate.toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' })}</div>
          {getWeekDays(currentDate).map(day => {
            const dStr = day.toISOString().split('T')[0];
            const plans = scheduled?.filter(s => s.date === dStr) || [];
            return (
              <div key={dStr} className={`bg-white rounded-xl shadow-sm p-3 border-l-4 ${dStr === todayStr ? 'border-blue-500 ring-1 ring-blue-100' : 'border-transparent'}`}>
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold">{day.getDate()}</span>
                    <span className="text-sm text-gray-500 capitalize">{day.toLocaleDateString('uk-UA', { weekday: 'short' })}</span>
                  </div>
                  <button onClick={() => setPlanModalDate(dStr)} className="bg-blue-50 text-blue-600 p-1.5 rounded"><Plus size={18} /></button>
                </div>
                {plans.map(p => {
                  const w = workouts?.find(w => w.id === p.workoutId);
                  return (
                    <div key={p.id} className="mt-2 p-2 bg-gray-50 rounded border flex justify-between items-center">
                      <span className="font-bold text-sm">{w?.name || 'Видалене тренування'}</span>
                      <div className="flex gap-2">
                        <button className="text-[10px] bg-green-500 text-white px-2 py-1 rounded font-bold">СТАРТ</button>
                        <button onClick={() => db.scheduled.delete(p.id)} className="text-red-500"><Trash2 size={14}/></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Модалка вибору тренування */}
      {planModalDate && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-[100] pb-20">
          <div className="bg-white w-full rounded-t-2xl p-4 max-h-[70vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">План на {planModalDate}</h3>
              <button onClick={() => setPlanModalDate(null)} className="text-red-500"><X /></button>
            </div>
            <div className="space-y-2">
              {workouts?.length === 0 && <p className="text-gray-500 text-center">База тренувань порожня.</p>}
              {workouts?.map(w => (
                <button key={w.id} onClick={() => handlePlan(w.id)} className="w-full text-left p-3 bg-gray-50 rounded-lg font-bold border">
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
// 3. РЕДАКТОР ШАБЛОНІВ ТРЕНУВАНЬ
// ==========================================
function Workouts() {
  const workouts = useLiveQuery(() => db.workouts.toArray());
  const exercises = useLiveQuery(() => db.exercises.toArray());
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [name, setName] = useState('');
  const [items, setItems] = useState<WorkoutItem[]>([]);
  const [showAddEx, setShowAddEx] = useState(false);

  const startEdit = (w: Workout | null) => {
    if (w) { setEditingId(w.id); setName(w.name); setItems(w.items || []); } 
    else { setEditingId('new'); setName(''); setItems([]); }
  };

  const saveWorkout = async () => {
    if (!name.trim()) return;
    const data = { name, items, note: '' };
    if (editingId === 'new') await db.workouts.add({ id: crypto.randomUUID(), ...data });
    else if (editingId) await db.workouts.update(editingId, data);
    setEditingId(null);
  };

  const updateItem = (index: number, field: keyof WorkoutItem, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  if (editingId) {
    return (
      <div className="p-4 pb-24">
        <div className="flex justify-between items-center mb-4">
          <button onClick={() => setEditingId(null)} className="text-gray-500 font-bold">Скасувати</button>
          <button onClick={saveWorkout} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex gap-2"><Save size={20}/> Зберегти</button>
        </div>
        
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Назва тренування" className="w-full p-3 border rounded-lg mb-6 font-bold text-lg shadow-sm" />
        
        <div className="space-y-4 mb-6">
          {items.map((item, idx) => {
            const exName = exercises?.find(e => e.id === item.exerciseId)?.name || 'Невідома вправа';
            return (
              <div key={idx} className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-bold text-blue-800">{exName}</span>
                  <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-red-500"><Trash2 size={18}/></button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold uppercase">Вага</label>
                    <input value={item.weight} onChange={e => updateItem(idx, 'weight', e.target.value)} placeholder="24 кг" className="w-full p-2 border rounded text-sm bg-gray-50" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold uppercase">Еспандер</label>
                    <input value={item.band} onChange={e => updateItem(idx, 'band', e.target.value)} placeholder="Червоний" className="w-full p-2 border rounded text-sm bg-gray-50" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold uppercase">Повтори</label>
                    <input value={item.reps} onChange={e => updateItem(idx, 'reps', e.target.value)} placeholder="10-5-10" className="w-full p-2 border rounded text-sm bg-gray-50" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button onClick={() => setShowAddEx(true)} className="w-full bg-blue-50 text-blue-600 py-3 rounded-lg font-bold border border-dashed border-blue-300 flex items-center justify-center gap-2">
          <Plus size={20} /> Додати вправу до тренування
        </button>

        {showAddEx && (
          <div className="fixed inset-0 bg-black/50 flex items-end z-[100] pb-20">
            <div className="bg-white w-full rounded-t-2xl p-4 max-h-[70vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold">Оберіть вправу з довідника</h3>
                <button onClick={() => setShowAddEx(false)} className="text-red-500"><X/></button>
              </div>
              <div className="space-y-2">
                {exercises?.map(ex => (
                  <button key={ex.id} onClick={() => { setItems([...items, { exerciseId: ex.id, weight: '', band: '', reps: '', note: '' }]); setShowAddEx(false); }} className="w-full text-left p-3 bg-gray-50 border rounded font-medium">
                    {ex.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 pb-24">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Шаблони тренувань</h2>
        <button onClick={() => startEdit(null)} className="bg-blue-600 text-white p-2 rounded-lg shadow-sm"><Plus /></button>
      </div>
      <div className="space-y-4">
        {workouts?.map(w => (
          <div key={w.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-bold text-lg text-blue-800">{w.name}</h3>
              <div className="flex gap-4">
                <button onClick={() => startEdit(w)} className="text-gray-400"><Edit2 size={18}/></button>
                <button onClick={() => db.workouts.delete(w.id)} className="text-red-400"><Trash2 size={18}/></button>
              </div>
            </div>
            <div className="text-sm text-gray-600 space-y-1">
              {w.items?.map((item, i) => {
                const exName = exercises?.find(e => e.id === item.exerciseId)?.name || 'Видалена вправа';
                return (
                  <div key={i} className="flex justify-between border-b border-gray-50 pb-1">
                    <span>{exName}</span>
                    <span className="text-xs text-gray-400 font-mono">[{item.weight || '-'} | {item.reps || '-'}]</span>
                  </div>
                );
              })}
              {(!w.items || w.items.length === 0) && <div className="italic text-gray-400 text-xs">Немає вправ</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==========================================
// 4. ДОВІДНИК ВПРАВ (CRUD)
// ==========================================
function Exercises() {
  const exercises = useLiveQuery(() => db.exercises.toArray());
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');

  const addEx = async () => {
    if (!newName.trim()) return;
    await db.exercises.add({ id: crypto.randomUUID(), name: newName, category: 'Користувацькі' });
    setNewName('');
  };

  const filtered = exercises?.filter(ex => ex.name.toLowerCase().includes(search.toLowerCase())) || [];

  return (
    <div className="p-4 pb-24">
      <h2 className="text-2xl font-bold mb-4">Довідник вправ</h2>
      <div className="flex gap-2 mb-4">
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Нова вправа..." className="flex-1 p-2 border rounded shadow-sm" />
        <button onClick={addEx} className="bg-blue-600 text-white px-4 rounded font-bold">Додати</button>
      </div>
      <input className="w-full p-2 mb-4 border rounded shadow-sm bg-gray-50" placeholder="Пошук по літерам..." value={search} onChange={e => setSearch(e.target.value)} />
      <div className="space-y-2">
        {filtered.map(ex => (
          <div key={ex.id} className="bg-white p-3 rounded shadow-sm border-l-4 border-blue-500 flex justify-between items-center">
            <span className="font-medium text-gray-800">{ex.name}</span>
            <button onClick={() => db.exercises.delete(ex.id)} className="text-red-400 p-1"><Trash2 size={16}/></button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==========================================
// 5. ТАЙМЕРИ (ТАБАТА + ФАКТИЧНИЙ ЧАС)
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
  const [freePhase, setFreePhase] = useState<'Розминка' | 'Основна' | 'Заминка' | 'Зупинено'>('Зупинено');

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
    if (mode === 'FREE' && freePhase !== 'Зупинено') {
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
          <div className={`w-64 h-64 rounded-full flex flex-col items-center justify-center text-white shadow-lg transition-colors ${phase === 'WORK' ? 'bg-red-500' : phase === 'REST' ? 'bg-green-500' : 'bg-gray-800'}`}>
            <span className="text-2xl font-bold">{phase === 'WORK' ? 'РОБОТА' : phase === 'REST' ? 'ВІДПОЧИНОК' : 'ГОТОВИЙ'}</span>
            <span className="text-7xl font-mono mt-2">{formatTime(timeLeft)}</span>
            {phase !== 'IDLE' && <span className="text-lg mt-2">Цикл {currentRound}/{rounds}</span>}
          </div>
          <button onClick={toggleTabata} className="mt-10 bg-blue-600 text-white px-8 py-4 rounded-xl text-2xl font-bold w-full shadow-lg">{isRunning ? 'ПАУЗА' : phase === 'IDLE' ? 'СТАРТ' : 'ПРОДОВЖИТИ'}</button>
          {phase !== 'IDLE' && !isRunning && <button onClick={() => { setPhase('IDLE'); setIsRunning(false); }} className="mt-4 text-red-600 px-8 py-3 rounded-xl font-bold w-full">Скинути</button>}
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <div className="text-6xl font-mono my-8">{formatTime(freeTime)}</div>
          <div className="text-xl font-bold mb-8 text-blue-600">{freePhase}</div>
          <div className="grid grid-cols-1 gap-4 w-full">
            <button onClick={() => { initAudio(); setFreePhase('Розминка'); }} className="bg-yellow-400 text-black py-4 rounded-xl font-bold shadow">Почати Розминку</button>
            <button onClick={() => { initAudio(); setFreePhase('Основна'); }} className="bg-red-500 text-white py-4 rounded-xl font-bold shadow">Почати Основну</button>
            <button onClick={() => { initAudio(); setFreePhase('Заминка'); }} className="bg-green-500 text-white py-4 rounded-xl font-bold shadow">Почати Заминку</button>
            <button onClick={() => { initAudio(); setFreePhase('Зупинено'); setFreeTime(0); }} className="bg-gray-800 text-white py-4 rounded-xl font-bold mt-4">Завершити</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 6. СИНХРОНІЗАЦІЯ ДАНИХ ТА ХМАРА
// ==========================================
function DataSync() {
  const exportData = async () => {
    const data = { exercises: await db.exercises.toArray(), workouts: await db.workouts.toArray(), scheduled: await db.scheduled.toArray(), history: await db.history.toArray() };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `w_jornal_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        await db.transaction('rw', db.exercises, db.workouts, db.scheduled, db.history, async () => {
          if (data.exercises) await db.exercises.bulkPut(data.exercises);
          if (data.workouts) await db.workouts.bulkPut(data.workouts);
          if (data.scheduled) await db.scheduled.bulkPut(data.scheduled);
          if (data.history) await db.history.bulkPut(data.history);
        });
        alert('Дані успішно відновлено! Оновіть сторінку.');
        window.location.reload();
      } catch (err) { alert('Помилка читання файлу'); }
    };
    reader.readAsText(file);
  };

  const clearPhone = async () => {
    if (window.confirm('УВАГА! Всі локальні дані будуть видалені. Ви зробили бекап?')) {
      await db.delete();
      alert('Телефон очищено. Додаток перезавантажиться.');
      window.location.reload();
    }
  };

  return (
    <div className="p-4 pb-24">
      <h2 className="text-2xl font-bold mb-6">Хмара / Дані</h2>
      <div className="space-y-4">
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <h3 className="font-bold mb-2">Експорт (Бекап)</h3>
          <p className="text-xs text-gray-500 mb-4">Збережіть файл з усіма даними на телефон, щоб не втратити історію.</p>
          <button onClick={exportData} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold">Вивантажити дані</button>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <h3 className="font-bold mb-2">Відновлення з Хмари / Файлу</h3>
          <p className="text-xs text-gray-500 mb-4">Оберіть раніше збережений JSON файл.</p>
          <input type="file" accept=".json" onChange={importData} className="w-full text-sm" />
        </div>
        <div className="bg-red-50 p-4 rounded-xl border border-red-200 mt-8">
          <h3 className="font-bold text-red-700 mb-2">Небезпечна зона</h3>
          <p className="text-xs text-red-500 mb-4">Очистити пам'ять телефона (Дані видаляться).</p>
          <button onClick={clearPhone} className="w-full bg-red-600 text-white py-3 rounded-lg font-bold">Очистити телефон</button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 7. НАВІГАЦІЯ ТА ІНІЦІАЛІЗАЦІЯ БАЗИ
// ==========================================
export default function App() {
  // ЦЕЙ БЛОК БУВ ВТРАЧЕНИЙ МИНУЛОГО РАЗУ. ВІН ЖИТТЄВО НЕОБХІДНИЙ ДЛЯ ЗАПОВНЕННЯ БАЗИ
  useEffect(() => {
    const initDb = async () => {
      const exCount = await db.exercises.count();
      if (exCount === 0) {
        // Зберігаємо вправи і запам'ятовуємо їхні нові ID
        const insertedExercises = initialExercises.map(ex => ({ id: crypto.randomUUID(), ...ex }));
        await db.exercises.bulkAdd(insertedExercises);

        // Тепер формуємо тренування, підставляючи згенеровані ID вправ
        const workoutsToInsert = initialWorkouts.map(w => {
          const items = w.exercises.map(exName => {
            const foundEx = insertedExercises.find(e => e.name === exName);
            return { exerciseId: foundEx ? foundEx.id : '', weight: '', band: '', reps: '', note: '' };
          }).filter(item => item.exerciseId !== '');
          
          return { id: crypto.randomUUID(), name: w.name, items, note: '' };
        });
        await db.workouts.bulkAdd(workoutsToInsert);
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
          <Route path="/data" element={<DataSync />} />
        </Routes>
        
        <nav className="fixed bottom-0 w-full bg-white border-t flex justify-between px-2 py-3 pb-6 shadow-[0_-5px_15px_-10px_rgba(0,0,0,0.1)] z-50">
          <Link to="/" className="flex flex-col items-center text-gray-600 w-1/5"><CalendarIcon size={22} /><span className="text-[9px] mt-1 font-bold uppercase">План</span></Link>
          <Link to="/workouts" className="flex flex-col items-center text-gray-600 w-1/5"><Activity size={22} /><span className="text-[9px] mt-1 font-bold uppercase">Тренування</span></Link>
          <Link to="/exercises" className="flex flex-col items-center text-gray-600 w-1/5"><Dumbbell size={22} /><span className="text-[9px] mt-1 font-bold uppercase">Вправи</span></Link>
          <Link to="/timer" className="flex flex-col items-center text-gray-600 w-1/5"><TimerIcon size={22} /><span className="text-[9px] mt-1 font-bold uppercase">Таймер</span></Link>
          <Link to="/data" className="flex flex-col items-center text-gray-600 w-1/5"><Settings size={22} /><span className="text-[9px] mt-1 font-bold uppercase">Дані</span></Link>
        </nav>
      </div>
    </BrowserRouter>
  );
}
