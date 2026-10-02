import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { Dumbbell, Timer as TimerIcon, Calendar as CalendarIcon, Activity, Plus, Settings, Trash2, Edit2, Save, X, ChevronLeft, ChevronRight, Play, CheckCircle2, ChevronUp, ChevronDown } from 'lucide-react';
import Dexie, { Table } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';

// ==========================================
// 1. БАЗА ДАНИХ ТА ФУНКЦІЇ ДАТ
// ==========================================
export interface Exercise { id: string; name: string; category: string; }
export interface WorkoutItem { exerciseId: string; weight: string; band: string; reps: string; note: string; }
export interface Workout { id: string; name: string; items: WorkoutItem[]; note: string; }
export interface Scheduled { id: string; date: string; workoutId: string; isCompleted: boolean; }
export interface History { id: string; date: string; workoutName: string; duration: number; items: WorkoutItem[]; note?: string; }

export class WorkoutJournalDB extends Dexie {
  exercises!: Table<Exercise, string>;
  workouts!: Table<Workout, string>;
  scheduled!: Table<Scheduled, string>;
  history!: Table<History, string>;
  constructor() {
    super('WJornalDB_v7');
    this.version(1).stores({ exercises: 'id, name, category', workouts: 'id, name', scheduled: 'id, date', history: 'id, date' });
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

const formatDuration = (secs: number) => {
  if (secs === 0) return '--:--';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const getLocalDateString = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ==========================================
// 2. КАЛЕНДАР (МАТРИЦЯ + МІСЯЦЬ)
// ==========================================
function CalendarView() {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'matrix' | 'month'>('matrix');
  const [dayOffset, setDayOffset] = useState(0); 
  
  const scheduled = useLiveQuery(() => db.scheduled.toArray());
  const historyData = useLiveQuery(() => db.history.toArray());
  const workouts = useLiveQuery(() => db.workouts.toArray());
  
  const [planModalDate, setPlanModalDate] = useState<string | null>(null);
  const [dayDetailsDate, setDayDetailsDate] = useState<string | null>(null);
  const [activePlanAction, setActivePlanAction] = useState<Scheduled | null>(null);
  const [activeHistoryAction, setActiveHistoryAction] = useState<History | null>(null);
  
  const [planNote, setPlanNote] = useState('');
  useEffect(() => { if (!activePlanAction) setPlanNote(''); }, [activePlanAction]);

  const getMonthDays = (year: number, month: number) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    return days;
  };

  const todayStr = getLocalDateString(new Date());

  const visibleDays = Array.from({ length: 5 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset + i - 2); 
    return d;
  });

  const handlePlan = async (workoutId: string) => {
    if (planModalDate) {
      await db.scheduled.add({ id: crypto.randomUUID(), date: planModalDate, workoutId, isCompleted: false });
      setPlanModalDate(null);
    }
  };

  const handleMarkDone = async (plan: Scheduled, workoutName: string, items: WorkoutItem[]) => {
    await db.history.add({ id: crypto.randomUUID(), date: plan.date, workoutName, duration: 0, items, note: planNote });
    await db.scheduled.delete(plan.id);
    setActivePlanAction(null);
  };

  const handleStart = (plan: Scheduled, workout: Workout) => {
    setActivePlanAction(null);
    navigate('/timer', { state: { plan, workout } });
  };

  const handleCellClickMatrix = async (dStr: string, workout: Workout, isPlanned: boolean, planObj?: Scheduled) => {
    if (isPlanned && planObj) {
      setActivePlanAction(planObj);
    } else {
      await db.scheduled.add({ id: crypto.randomUUID(), date: dStr, workoutId: workout.id, isCompleted: false });
    }
  };

  return (
    <div className="p-2 pb-24">
      <div className="flex justify-between items-center mb-4 px-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded">v1.6</span>
          <div className="flex bg-gray-200 rounded-lg p-1">
            <button className={`px-4 py-1 rounded-md text-sm font-bold ${view === 'matrix' ? 'bg-white shadow' : ''}`} onClick={() => setView('matrix')}>Таблиця</button>
            <button className={`px-4 py-1 rounded-md text-sm font-bold ${view === 'month' ? 'bg-white shadow' : ''}`} onClick={() => setView('month')}>Місяць</button>
          </div>
        </div>
        <button onClick={() => { setCurrentDate(new Date()); setDayOffset(0); }} className="text-blue-600 font-bold text-sm bg-blue-50 px-3 py-1 rounded">Сьогодні</button>
      </div>

      {view === 'month' && (
        <div className="bg-white rounded-xl shadow-sm p-4 mx-2">
          <div className="flex gap-2 mb-4">
            <select value={currentDate.getMonth()} onChange={e => { const d = new Date(currentDate); d.setMonth(Number(e.target.value)); setCurrentDate(d); }} className="p-2 border rounded font-bold bg-gray-50 flex-1">
              {Array.from({length: 12}).map((_, i) => <option key={i} value={i}>{new Date(2000, i).toLocaleDateString('uk-UA', {month: 'long'})}</option>)}
            </select>
            <select value={currentDate.getFullYear()} onChange={e => { const d = new Date(currentDate); d.setFullYear(Number(e.target.value)); setCurrentDate(d); }} className="p-2 border rounded font-bold bg-gray-50 w-24">
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2 text-gray-500 font-bold">
            <div>Пн</div><div>Вт</div><div>Ср</div><div>Чт</div><div>Пт</div><div>Сб</div><div>Нд</div>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: (new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay() + 6) % 7 }).map((_, i) => <div key={`e-${i}`} />)}
            {getMonthDays(currentDate.getFullYear(), currentDate.getMonth()).map(day => {
              const dStr = getLocalDateString(day);
              const plans = scheduled?.filter(s => s.date === dStr) || [];
              const hists = historyData?.filter(h => h.date === dStr) || [];
              
              let bgClass = 'bg-white border-transparent';
              let textClass = 'text-gray-700';
              let indicator = null;

              if (hists.length > 0) { 
                bgClass = 'bg-green-100 border-green-300'; 
                textClass = 'text-green-800 font-bold'; 
                indicator = <div className="text-[10px]">✓</div>;
              } else if (plans.length > 0) { 
                bgClass = 'bg-white border-gray-200 shadow-sm'; 
                textClass = 'text-gray-900 font-bold'; 
                const w = workouts?.find(w => w.id === plans[0].workoutId);
                const firstLetter = w ? w.name.charAt(0).toUpperCase() : '?';
                indicator = <div className="text-[10px] text-blue-600 font-bold leading-none mt-1">{firstLetter}</div>;
              }
              
              return (
                <div key={dStr} onClick={() => setDayDetailsDate(dStr)} className={`aspect-square flex flex-col items-center justify-center rounded-md text-sm cursor-pointer border ${bgClass} ${textClass} ${dStr === todayStr ? 'ring-2 ring-blue-500' : ''}`}>
                  <span>{day.getDate()}</span>
                  {indicator}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === 'matrix' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto relative">
          <table className="w-full text-left border-collapse min-w-max">
            <thead>
              <tr>
                <th className="sticky left-0 bg-white z-10 p-2 border-b border-r min-w-[100px] max-w-[120px]">
                  <div className="flex justify-between items-center bg-gray-100 rounded-md p-1">
                    <button onClick={() => setDayOffset(d => d - 1)} className="px-2 py-1 bg-white rounded shadow-sm text-gray-600 active:bg-gray-200"><ChevronLeft size={16}/></button>
                    <span className="text-[9px] font-bold text-gray-500">ПЕРІОД</span>
                    <button onClick={() => setDayOffset(d => d + 1)} className="px-2 py-1 bg-white rounded shadow-sm text-gray-600 active:bg-gray-200"><ChevronRight size={16}/></button>
                  </div>
                </th>
                {visibleDays.map(day => {
                  const dStr = getLocalDateString(day);
                  const isToday = dStr === todayStr;
                  return (
                    <th key={dStr} className={`p-2 border-b text-center min-w-[55px] ${isToday ? 'bg-blue-50' : ''}`}>
                      <div className={`text-[10px] uppercase ${isToday ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
                        {day.toLocaleDateString('uk-UA', { weekday: 'short' })}
                      </div>
                      <div className={`text-sm font-bold ${isToday ? 'text-blue-700' : 'text-gray-800'}`}>
                        {day.getDate()}.{(day.getMonth() + 1).toString().padStart(2, '0')}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {workouts?.slice().sort((a, b) => a.name.localeCompare(b.name, 'uk-UA')).map(w => (
                <tr key={w.id} className="hover:bg-gray-50">
                  <td className="sticky left-0 bg-white z-10 p-2 border-b border-r text-[10px] font-bold text-gray-700 leading-tight truncate max-w-[120px]" style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
                    {w.name}
                  </td>
                  {visibleDays.map(day => {
                    const dStr = getLocalDateString(day);
                    const isToday = dStr === todayStr;
                    const hist = historyData?.find(h => h.date === dStr && h.workoutName === w.name);
                    const plan = scheduled?.find(s => s.date === dStr && s.workoutId === w.id);

                    return (
                      <td key={dStr} className={`p-1 border-b text-center align-middle border-l border-gray-100 ${isToday && !hist ? 'bg-blue-50/50' : ''}`}>
                        {hist ? (
                          <div onClick={() => setActiveHistoryAction(hist)} className="bg-green-100 text-green-800 text-[10px] font-bold py-1.5 px-1 rounded shadow-sm flex flex-col items-center cursor-pointer hover:bg-green-200 transition-colors">
                            <span className="opacity-70 text-[8px] mb-0.5">ЧАС</span>
                            {formatDuration(hist.duration)}
                          </div>
                        ) : plan ? (
                          <button onClick={() => handleCellClickMatrix(dStr, w, true, plan)} className="bg-blue-500 text-white text-[10px] font-bold py-1.5 px-1 rounded w-full shadow-sm active:bg-blue-600">
                            ПЛАН
                          </button>
                        ) : (
                          <div onClick={() => handleCellClickMatrix(dStr, w, false)} className="h-8 w-full rounded flex items-center justify-center hover:bg-gray-100 cursor-pointer text-gray-300 hover:text-gray-400">
                            <Plus size={14} />
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Модалка: Деталі дня */}
      {dayDetailsDate && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-[100] pb-20">
          <div className="bg-white w-full rounded-t-2xl p-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h3 className="font-bold text-lg">Деталі за {dayDetailsDate}</h3>
              <button onClick={() => setDayDetailsDate(null)} className="text-gray-400 bg-gray-100 rounded-full p-1"><X size={20}/></button>
            </div>
            
            {/* Виконані (Історія) */}
            {historyData?.filter(h => h.date === dayDetailsDate).map(h => (
              <div key={h.id} className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl relative">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-green-800 text-lg">✓ {h.workoutName}</span>
                  <span className="text-sm font-mono bg-green-100 text-green-800 px-2 py-1 rounded">{formatDuration(h.duration)}</span>
                </div>
                {h.note && (
                  <div className="mt-2 text-sm text-gray-700 bg-white p-3 rounded-lg border border-green-100 shadow-sm whitespace-pre-wrap">
                    <span className="font-bold text-xs text-gray-400 block mb-1">ПРИМІТКА:</span>
                    {h.note}
                  </div>
                )}
                <button onClick={() => db.history.delete(h.id)} className="mt-3 w-full bg-red-100 text-red-600 p-2 rounded-lg font-bold flex justify-center items-center gap-2"><Trash2 size={16}/> Видалити запис</button>
              </div>
            ))}

            {/* Заплановані */}
            {scheduled?.filter(s => s.date === dayDetailsDate).map(p => {
              const w = workouts?.find(x => x.id === p.workoutId);
              return (
                <div key={p.id} className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-xl">
                  <div className="font-bold text-gray-800 mb-3 text-lg">ПЛАН: {w?.name || 'Видалене'}</div>
                  <div className="flex gap-2">
                    <button onClick={() => { setDayDetailsDate(null); if (w) handleStart(p, w); }} className="flex-1 bg-blue-500 text-white p-3 rounded-lg font-bold text-xs flex justify-center items-center gap-1"><Play size={16}/> СТАРТ</button>
                    <button onClick={() => { setDayDetailsDate(null); setActivePlanAction(p); }} className="flex-1 bg-gray-200 text-gray-800 p-3 rounded-lg font-bold text-xs flex justify-center items-center gap-1"><CheckCircle2 size={16}/> ВІДМІТИТИ</button>
                    <button onClick={() => db.scheduled.delete(p.id)} className="bg-red-50 text-red-500 p-3 rounded-lg"><Trash2 size={16}/></button>
                  </div>
                </div>
              );
            })}

            <button onClick={() => { setPlanModalDate(dayDetailsDate); setDayDetailsDate(null); }} className="w-full mt-2 p-3 bg-blue-50 text-blue-600 rounded-lg font-bold border border-dashed border-blue-300">
              + Додати план на цей день
            </button>
          </div>
        </div>
      )}

      {/* Модалка: Дії з планом */}
      {activePlanAction && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-[100] pb-20">
          <div className="bg-white w-full rounded-t-2xl p-4">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h3 className="font-bold text-lg text-gray-800">Дія з планом</h3>
              <button onClick={() => setActivePlanAction(null)} className="text-gray-400 bg-gray-100 rounded-full p-1"><X size={20}/></button>
            </div>
            
            <div className="space-y-3">
              <button onClick={() => { const w = workouts?.find(x => x.id === activePlanAction.workoutId); if (w) handleStart(activePlanAction, w); }} className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm">
                <Play size={20} /> Почати тренування (Таймер)
              </button>
              
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 mt-4">
                <textarea value={planNote} onChange={e => setPlanNote(e.target.value)} placeholder="Додати примітку (самопочуття, вага...)" className="w-full p-3 border rounded-lg mb-3 bg-white text-sm shadow-sm min-h-[80px]" />
                <button onClick={() => { const w = workouts?.find(x => x.id === activePlanAction.workoutId); if (w) handleMarkDone(activePlanAction, w.name, w.items); }} className="w-full bg-gray-200 text-gray-800 p-3 rounded-lg font-bold flex items-center justify-center gap-2">
                  <CheckCircle2 size={18} className="text-gray-600" /> Відмітити ВИКОНАНО (--:--)
                </button>
              </div>

              <button onClick={async () => { await db.scheduled.delete(activePlanAction.id); setActivePlanAction(null); }} className="w-full bg-red-50 text-red-600 p-3 rounded-xl font-bold flex items-center justify-center gap-2 mt-4">
                <Trash2 size={18} /> Видалити план
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка: Інформація про виконане тренування з Матриці */}
      {activeHistoryAction && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-[100] pb-20">
          <div className="bg-white w-full rounded-t-2xl p-4">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h3 className="font-bold text-lg text-green-800 flex items-center gap-2"><CheckCircle2/> {activeHistoryAction.workoutName}</h3>
              <button onClick={() => setActiveHistoryAction(null)} className="text-gray-400 bg-gray-100 rounded-full p-1"><X size={20}/></button>
            </div>
            <div className="mb-4">
              <div className="text-xs text-gray-500 font-bold mb-1 uppercase">Час виконання</div>
              <div className="text-3xl font-mono text-gray-800">{formatDuration(activeHistoryAction.duration)}</div>
            </div>
            {activeHistoryAction.note && (
              <div className="mb-6 bg-gray-50 p-3 rounded-xl border border-gray-100">
                <div className="text-xs text-gray-500 font-bold mb-1 uppercase">Примітка</div>
                <div className="text-sm text-gray-800 whitespace-pre-wrap">{activeHistoryAction.note}</div>
              </div>
            )}
            <button onClick={() => { db.history.delete(activeHistoryAction.id); setActiveHistoryAction(null); }} className="w-full bg-red-100 text-red-600 p-4 rounded-xl font-bold flex items-center justify-center gap-2">
              <Trash2 size={20} /> Видалити з історії
            </button>
          </div>
        </div>
      )}

      {/* Модалка: Вибір тренування з бази */}
      {planModalDate && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-[100] pb-20">
          <div className="bg-white w-full rounded-t-2xl p-4 max-h-[70vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">План на {planModalDate}</h3>
              <button onClick={() => setPlanModalDate(null)} className="text-red-500 bg-red-50 rounded-full p-1"><X size={20}/></button>
            </div>
            <div className="space-y-2">
              {workouts?.length === 0 && <p className="text-gray-500 text-center">База тренувань порожня.</p>}
              {workouts?.slice().sort((a, b) => a.name.localeCompare(b.name, 'uk-UA')).map(w => (
                <button key={w.id} onClick={() => handlePlan(w.id)} className="w-full text-left p-4 bg-gray-50 rounded-xl font-bold border active:bg-gray-200 shadow-sm">
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

  const moveItemUp = (index: number) => {
    if (index === 0) return;
    const newItems = [...items];
    [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
    setItems(newItems);
  };

  const moveItemDown = (index: number) => {
    if (index === items.length - 1) return;
    const newItems = [...items];
    [newItems[index + 1], newItems[index]] = [newItems[index], newItems[index + 1]];
    setItems(newItems);
  };

  if (editingId) {
    const sortedExercises = exercises?.slice().sort((a, b) => a.name.localeCompare(b.name, 'uk-UA')) || [];

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
                  <span className="font-bold text-blue-800 leading-tight pr-2">{exName}</span>
                  <div className="flex gap-1">
                    <button onClick={() => moveItemUp(idx)} disabled={idx === 0} className="text-gray-500 disabled:opacity-20 p-1 bg-gray-100 rounded"><ChevronUp size={18}/></button>
                    <button onClick={() => moveItemDown(idx)} disabled={idx === items.length - 1} className="text-gray-500 disabled:opacity-20 p-1 bg-gray-100 rounded"><ChevronDown size={18}/></button>
                    <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-red-500 bg-red-50 p-1 rounded ml-2"><Trash2 size={18}/></button>
                  </div>
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
          <Plus size={20} /> Додати вправу
        </button>

        {showAddEx && (
          <div className="fixed inset-0 bg-black/50 flex items-end z-[100] pb-20">
            <div className="bg-white w-full rounded-t-2xl p-4 max-h-[70vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4 border-b pb-2">
                <h3 className="font-bold text-lg">Оберіть вправу</h3>
                <button onClick={() => setShowAddEx(false)} className="text-gray-400 bg-gray-100 rounded-full p-1"><X size={20}/></button>
              </div>
              <div className="space-y-2">
                {sortedExercises.map(ex => (
                  <button key={ex.id} onClick={() => { setItems([...items, { exerciseId: ex.id, weight: '', band: '', reps: '', note: '' }]); setShowAddEx(false); }} className="w-full text-left p-3 bg-gray-50 border rounded font-medium active:bg-gray-200">
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

  const sortedWorkouts = workouts?.slice().sort((a, b) => a.name.localeCompare(b.name, 'uk-UA'));

  return (
    <div className="p-4 pb-24">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Шаблони тренувань</h2>
        <button onClick={() => startEdit(null)} className="bg-blue-600 text-white p-2 rounded-lg shadow-sm"><Plus /></button>
      </div>
      <div className="space-y-4">
        {sortedWorkouts?.map(w => (
          <div key={w.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-bold text-lg text-blue-800">{w.name}</h3>
              <div className="flex gap-4">
                <button onClick={() => startEdit(w)} className="text-gray-400"><Edit2 size={18}/></button>
                <button onClick={() => db.workouts.delete(w.id)} className="text-red-400 bg-red-50 p-1 rounded"><Trash2 size={18}/></button>
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
// 4. ДОВІДНИК ВПРАВ
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

  const filtered = exercises
    ?.filter(ex => ex.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, 'uk-UA')) || [];

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
// 5. ТАЙМЕРИ ТА ВИКОНАННЯ ТРЕНУВАННЯ
// ==========================================
function NumberControl({ label, value, setValue }: { label: string, value: number, setValue: (v: number | ((prev: number) => number)) => void }) {
  return (
    <div className="flex items-center justify-between w-full py-2 border-b border-gray-100 last:border-0">
      <div className="text-sm text-gray-500 font-bold uppercase">{label}</div>
      <div className="flex items-center gap-2">
        <button onClick={() => setValue(v => Math.max(1, typeof v === 'number' ? v - 1 : v))} className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded-xl text-2xl font-bold text-gray-600 active:bg-gray-200 shadow-sm">-</button>
        <input type="number" value={value} onChange={e => setValue(Math.max(1, Number(e.target.value)))} className="w-16 text-center font-bold text-xl bg-transparent outline-none p-0 m-0" />
        <button onClick={() => setValue(v => (typeof v === 'number' ? v + 1 : v))} className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded-xl text-2xl font-bold text-gray-600 active:bg-gray-200 shadow-sm">+</button>
      </div>
    </div>
  );
}

function Timers() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeWorkoutData = location.state as { plan: Scheduled, workout: Workout } | null;

  const [mode, setMode] = useState<'TABATA' | 'FREE'>(activeWorkoutData ? 'FREE' : 'TABATA');
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
  const [workoutNote, setWorkoutNote] = useState('');
  
  const [phaseTimes, setPhaseTimes] = useState({ warmup: 0, main: 0, cooldown: 0 });

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
    if (phase === 'IDLE') {
      setTimeLeft(workTime);
    }
  }, [workTime, phase]);

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
      t = window.setInterval(() => {
        setFreeTime(prev => prev + 1);
        setPhaseTimes(prev => {
          if (freePhase === 'Розминка') return { ...prev, warmup: prev.warmup + 1 };
          if (freePhase === 'Основна') return { ...prev, main: prev.main + 1 };
          if (freePhase === 'Заминка') return { ...prev, cooldown: prev.cooldown + 1 };
          return prev;
        });
      }, 1000);
    }
    return () => clearInterval(t);
  }, [freePhase, mode]);

  const toggleTabata = () => {
    initAudio();
    if (!isRunning && phase === 'IDLE') { setPhase('WORK'); setTimeLeft(workTime); setCurrentRound(1); }
    setIsRunning(!isRunning);
  };

  const finishFreeWorkout = async () => {
    initAudio();
    setFreePhase('Зупинено');
    
    if (activeWorkoutData) {
      const breakdownInfo = `[Розминка: ${formatDuration(phaseTimes.warmup)} | Основна: ${formatDuration(phaseTimes.main)} | Заминка: ${formatDuration(phaseTimes.cooldown)}]`;
      const finalNote = workoutNote ? `${workoutNote}\n\n${breakdownInfo}` : breakdownInfo;

      await db.history.add({
        id: crypto.randomUUID(),
        date: getLocalDateString(new Date()),
        workoutName: activeWorkoutData.workout.name,
        duration: freeTime,
        items: activeWorkoutData.workout.items,
        note: finalNote
      });
      await db.scheduled.delete(activeWorkoutData.plan.id);
      navigate('/');
    }
    
    setFreeTime(0);
    setPhaseTimes({ warmup: 0, main: 0, cooldown: 0 });
    setWorkoutNote('');
  };

  return (
    <div className="p-4 pb-24">
      {activeWorkoutData && (
        <div className="bg-blue-100 border border-blue-300 p-3 rounded-lg mb-4 flex justify-between items-center shadow-sm">
          <span className="font-bold text-blue-800 text-sm">Виконується: {activeWorkoutData.workout.name}</span>
          <button onClick={() => navigate('/')} className="text-blue-500 bg-white rounded-full p-1"><X size={16}/></button>
        </div>
      )}

      <div className="flex bg-gray-200 rounded-lg p-1 mb-6">
        <button className={`flex-1 py-2 font-bold rounded-md ${mode === 'TABATA' ? 'bg-white shadow' : 'text-gray-500'}`} onClick={() => setMode('TABATA')}>Табата</button>
        <button className={`flex-1 py-2 font-bold rounded-md ${mode === 'FREE' ? 'bg-white shadow' : 'text-gray-500'}`} onClick={() => setMode('FREE')}>Фактичний час</button>
      </div>

      {mode === 'TABATA' ? (
        <div className="flex flex-col items-center">
          {!isRunning && phase === 'IDLE' && (
            <div className="w-full bg-white p-4 rounded-xl shadow-sm mb-6 flex flex-col">
              <NumberControl label="Робота (сек)" value={workTime} setValue={setWorkTime as any} />
              <NumberControl label="Відпочинок (сек)" value={restTime} setValue={setRestTime as any} />
              <NumberControl label="Цикли" value={rounds} setValue={setRounds as any} />
            </div>
          )}
          <div className={`w-64 h-64 rounded-full flex flex-col items-center justify-center text-white shadow-lg transition-colors ${phase === 'WORK' ? 'bg-red-500' : phase === 'REST' ? 'bg-green-500' : 'bg-gray-800'}`}>
            <span className="text-2xl font-bold">{phase === 'WORK' ? 'РОБОТА' : phase === 'REST' ? 'ВІДПОЧИНОК' : 'ГОТОВИЙ'}</span>
            <span className="text-7xl font-mono mt-2">{formatDuration(timeLeft)}</span>
            {phase !== 'IDLE' && <span className="text-lg mt-2">Цикл {currentRound}/{rounds}</span>}
          </div>
          <button onClick={toggleTabata} className="mt-10 bg-blue-600 text-white px-8 py-4 rounded-xl text-2xl font-bold w-full shadow-lg">{isRunning ? 'ПАУЗА' : phase === 'IDLE' ? 'СТАРТ' : 'ПРОДОВЖИТИ'}</button>
          {phase !== 'IDLE' && !isRunning && <button onClick={() => { setPhase('IDLE'); setIsRunning(false); }} className="mt-4 text-red-600 px-8 py-3 rounded-xl font-bold w-full">Скинути</button>}
        </div>
      ) : (
        <div className="flex flex-col items-center w-full">
          <div className="text-6xl font-mono mt-4 mb-2">{formatDuration(freeTime)}</div>
          <div className="text-lg font-bold mb-4 text-blue-600 uppercase">{freePhase}</div>

          <div className="w-full flex justify-between bg-white p-3 rounded-xl shadow-sm mb-6 border border-gray-100">
            <div className="text-center w-1/3">
              <div className="text-[10px] text-gray-400 font-bold uppercase">Розминка</div>
              <div className={`font-mono text-lg ${freePhase === 'Розминка' ? 'text-yellow-500 font-bold' : 'text-gray-700'}`}>{formatDuration(phaseTimes.warmup)}</div>
            </div>
            <div className="text-center w-1/3 border-l border-r border-gray-100">
              <div className="text-[10px] text-gray-400 font-bold uppercase">Основна</div>
              <div className={`font-mono text-lg ${freePhase === 'Основна' ? 'text-red-500 font-bold' : 'text-gray-700'}`}>{formatDuration(phaseTimes.main)}</div>
            </div>
            <div className="text-center w-1/3">
              <div className="text-[10px] text-gray-400 font-bold uppercase">Заминка</div>
              <div className={`font-mono text-lg ${freePhase === 'Заминка' ? 'text-green-500 font-bold' : 'text-gray-700'}`}>{formatDuration(phaseTimes.cooldown)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 w-full">
            <button onClick={() => { initAudio(); setFreePhase('Розминка'); }} className={`py-4 rounded-xl font-bold shadow-sm transition-colors ${freePhase === 'Розминка' ? 'bg-yellow-400 text-black ring-2 ring-yellow-500 ring-offset-2' : 'bg-gray-100 text-gray-600'}`}>Почати Розминку</button>
            <button onClick={() => { initAudio(); setFreePhase('Основна'); }} className={`py-4 rounded-xl font-bold shadow-sm transition-colors ${freePhase === 'Основна' ? 'bg-red-500 text-white ring-2 ring-red-500 ring-offset-2' : 'bg-gray-100 text-gray-600'}`}>Почати Основну</button>
            <button onClick={() => { initAudio(); setFreePhase('Заминка'); }} className={`py-4 rounded-xl font-bold shadow-sm transition-colors ${freePhase === 'Заминка' ? 'bg-green-500 text-white ring-2 ring-green-500 ring-offset-2' : 'bg-gray-100 text-gray-600'}`}>Почати Заминку</button>
            
            {activeWorkoutData && (
              <textarea value={workoutNote} onChange={e => setWorkoutNote(e.target.value)} placeholder="Примітка до тренування (самопочуття, вага...)" className="w-full p-3 border rounded-lg mt-4 bg-white text-sm shadow-sm min-h-[80px]" />
            )}
            
            <button 
              onClick={() => {
                if(!activeWorkoutData) {
                  initAudio(); setFreePhase('Зупинено'); setFreeTime(0); setPhaseTimes({ warmup: 0, main: 0, cooldown: 0 });
                } else {
                  finishFreeWorkout();
                }
              }} 
              className="bg-gray-800 text-white py-4 rounded-xl font-bold mt-4 shadow-lg border-2 border-transparent active:border-gray-500"
            >
              {activeWorkoutData ? 'Завершити та Зберегти' : 'Зупинити таймер'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 6. СИНХРОНІЗАЦІЯ ДАНИХ
// ==========================================
function DataSync() {
  const exportData = async () => {
    const data = { exercises: await db.exercises.toArray(), workouts: await db.workouts.toArray(), scheduled: await db.scheduled.toArray(), history: await db.history.toArray() };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `w_jornal_backup_${getLocalDateString(new Date())}.json`;
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
          // Очищення перед імпортом для уникнення дублікатів (різні UUID на різних пристроях)
          await db.exercises.clear();
          await db.workouts.clear();
          await db.scheduled.clear();
          await db.history.clear();

          if (data.exercises) await db.exercises.bulkAdd(data.exercises);
          if (data.workouts) await db.workouts.bulkAdd(data.workouts);
          if (data.scheduled) await db.scheduled.bulkAdd(data.scheduled);
          if (data.history) await db.history.bulkAdd(data.history);
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
          <button onClick={exportData} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold">Вивантажити дані</button>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <h3 className="font-bold mb-2">Відновлення з файлу</h3>
          <input type="file" accept=".json" onChange={importData} className="w-full text-sm" />
        </div>
        <div className="bg-red-50 p-4 rounded-xl border border-red-200 mt-8">
          <h3 className="font-bold text-red-700 mb-2">Небезпечна зона</h3>
          <button onClick={clearPhone} className="w-full bg-red-600 text-white py-3 rounded-lg font-bold">Очистити телефон</button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 7. НАВІГАЦІЯ
// ==========================================
export default function App() {
  useEffect(() => {
    const initDb = async () => {
      const exCount = await db.exercises.count();
      if (exCount === 0) {
        const insertedExercises = initialExercises.map(ex => ({ id: crypto.randomUUID(), ...ex }));
        await db.exercises.bulkAdd(insertedExercises);
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
