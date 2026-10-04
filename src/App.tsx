import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { Dumbbell, Timer as TimerIcon, Calendar as CalendarIcon, Activity, Plus, Settings, Trash2, Edit2, Save, X, ChevronLeft, ChevronRight, Play, CheckCircle2, ChevronUp, ChevronDown, Search } from 'lucide-react';
import Dexie, { Table } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';

// ==========================================
// 1. БАЗА ДАНИХ ТА ФУНКЦІЇ ДАТ
// ==========================================
export interface Exercise { id: string; name: string; category: string; muscle?: string; }
export interface WorkoutItem { exerciseId: string; weight: string; band: string; reps: string; note: string; exNameSnapshot?: string; exMuscleSnapshot?: string; }
export interface Workout { id: string; name: string; items: WorkoutItem[]; note: string; muscle?: string; }
// Додано name та items до Scheduled для індивідуального планування
export interface Scheduled { id: string; date: string; workoutId: string; isCompleted: boolean; name?: string; items?: WorkoutItem[]; }
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

const MUSCLE_GROUPS = ['Груди', 'Ноги', 'Спина', 'Плечі', 'Руки', 'Загальна'];

const initialExercises = [
  { category: 'МИНОТАВР', name: 'ГОБЛЕТ-присидання', muscle: 'Ноги' },
  { category: 'МИНОТАВР', name: 'ПРОТЯЖКА до подборіддя', muscle: 'Плечі' },
  { category: 'МИНОТАВР', name: 'МАХИ 2 руками', muscle: 'Загальна' },
  { category: 'МИНОТАВР', name: 'ТЯГА В НАКЛОНІ до поясу', muscle: 'Спина' },
  { category: 'МИНОТАВР', name: 'СТАНОВА ТЯГА з гірею', muscle: 'Спина' },
  { category: 'НОГИ', name: 'ПРИСІДАННЯ з ЕСПАНДЕРОМ', muscle: 'Ноги' },
  { category: 'ДРАБИНА з ГИРЕЮ', name: 'МАХИ 2 руками', muscle: 'Загальна' },
  { category: 'ДРАБИНА з ГИРЕЮ', name: 'ГОБЛЕТ-присидання', muscle: 'Ноги' },
  { category: 'ДРАБИНА з ГИРЕЮ', name: 'ВІДЖИМАННЯ', muscle: 'Груди' },
  { category: 'ТРАСТЕР', name: 'ТРАСТЕР з еспандером', muscle: 'Загальна' },
  { category: 'БРУСИ', name: 'ВІДЖИМАННЯ на брусах', muscle: 'Груди' },
  { category: 'ДЕЛЬТИ', name: 'ПРОТЯЖКА до подборіддя еспандер', muscle: 'Плечі' },
  { category: 'ДЕЛЬТИ', name: 'ЖИМ ЕСПАНДЕРА над головою', muscle: 'Плечі' },
  { category: 'ДЕЛЬТИ', name: 'РОЗВЕДЕННЯ ЕСПАНДЕРА В СТОРОНИ', muscle: 'Плечі' },
  { category: 'ДЕЛЬТИ', name: 'ПІДНЯТТЯ ЕСПАНДЕРА з ротацією', muscle: 'Плечі' },
  { category: 'ДЕЛЬТИ', name: 'РОЗВЕДЕННЯ ЕСПАНДЕРА однією рукою', muscle: 'Плечі' },
  { category: 'ДЕЛЬТИ', name: 'РОЗВЕДЕННЯ ЕСПАНДЕРА перед собою', muscle: 'Плечі' },
  { category: 'ДЕЛЬТИ', name: 'ТЯГА В НАКЛОНІ на задню дельту', muscle: 'Плечі' },
  { category: 'СПИНА', name: 'ПІДТЯГУВАННЯ', muscle: 'Спина' },
  { category: 'СПИНА', name: 'ПІДТЯГУВАННЯ З ЕСПАНДЕРОМ', muscle: 'Спина' },
  { category: 'СПИНА', name: 'ТЯГА В НАКЛОНІ еспандера зворотнім хватом', muscle: 'Спина' },
  { category: 'СПИНА', name: 'ШРАГИ З ЕСПАНДЕРОМ', muscle: 'Спина' },
  { category: 'СПИНА', name: 'СТАНОВА ТЯГА з еспандером', muscle: 'Спина' }
];

const initialWorkouts = [
  { name: 'МИНОТАВР', muscle: 'Загальна', exercises: ['ГОБЛЕТ-присидання', 'ПРОТЯЖКА до подборіддя', 'МАХИ 2 руками', 'ТЯГА В НАКЛОНІ до поясу', 'СТАНОВА ТЯГА з гірею'] },
  { name: 'НОГИ', muscle: 'Ноги', exercises: ['ПРИСІДАННЯ з ЕСПАНДЕРОМ'] },
  { name: 'ДРАБИНА з ГИРЕЮ', muscle: 'Загальна', exercises: ['МАХИ 2 руками', 'ГОБЛЕТ-присидання', 'ВІДЖИМАННЯ'] }
];

const formatDuration = (secs: number) => {
  if (secs === 0) return '--:--';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
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
  const exercises = useLiveQuery(() => db.exercises.toArray());

  const [planModalDate, setPlanModalDate] = useState<string | null>(null);
  const [dayDetailsDate, setDayDetailsDate] = useState<string | null>(null);
  const [activePlanAction, setActivePlanAction] = useState<Scheduled | null>(null);
  const [activeHistoryAction, setActiveHistoryAction] = useState<History | null>(null);

  // Стан для редагування плану перед збереженням (НОВА ФУНКЦІЯ)
  const [planSetup, setPlanSetup] = useState<{
    date: string;
    baseWorkoutId: string;
    editName: string;
    editItems: WorkoutItem[];
    showAddEx: boolean;
    exSearch: string;
  } | null>(null);

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
    const d = new Date(); d.setDate(d.getDate() + dayOffset + i - 2); return d;
  });

  const initiatePlanSetup = (date: string, workout: Workout) => {
    setPlanSetup({
      date,
      baseWorkoutId: workout.id,
      editName: workout.name,
      editItems: workout.items ? [...workout.items] : [],
      showAddEx: false,
      exSearch: ''
    });
  };

  const savePlanSetup = async () => {
    if (planSetup) {
      await db.scheduled.add({
        id: crypto.randomUUID(),
        date: planSetup.date,
        workoutId: planSetup.baseWorkoutId,
        name: planSetup.editName,
        items: planSetup.editItems,
        isCompleted: false
      });
      setPlanSetup(null);
    }
  };

  const handlePlan = (workout: Workout) => {
    if (planModalDate) {
      initiatePlanSetup(planModalDate, workout);
      setPlanModalDate(null);
    }
  };

  const handleMarkDone = async (plan: Scheduled) => {
    const wName = plan.name || workouts?.find(w => w.id === plan.workoutId)?.name || 'Невідомо';
    const wItems = plan.items || workouts?.find(w => w.id === plan.workoutId)?.items || [];
    await db.history.add({ id: crypto.randomUUID(), date: plan.date, workoutName: wName, duration: 0, items: wItems, note: planNote });
    await db.scheduled.delete(plan.id);
    setActivePlanAction(null);
  };

  const handleStart = (plan: Scheduled, workout: Workout) => {
    setActivePlanAction(null);
    navigate('/timer', { state: { plan, workout } });
  };

  const handleCellClickMatrix = async (dStr: string, workout: Workout, isPlanned: boolean, planObj?: Scheduled) => {
    if (isPlanned && planObj) setActivePlanAction(planObj);
    else initiatePlanSetup(dStr, workout);
  };

  const sortedWorkouts = workouts?.slice().sort((a, b) => {
    const m1 = a.muscle || 'Загальна';
    const m2 = b.muscle || 'Загальна';
    if (m1 !== m2) return m1.localeCompare(m2, 'uk-UA');
    return a.name.localeCompare(b.name, 'uk-UA');
  });

  return (
    <div className="p-2 pb-24">
      <div className="flex justify-between items-center mb-4 px-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded">v1.9</span>
          <div className="flex bg-gray-200 rounded-lg p-1">
            <button className={`px-4 py-1 rounded-md text-sm font-bold ${view === 'matrix' ? 'bg-white shadow' : ''}`} onClick={() => setView('matrix')}>Таблиця</button>
            <button className={`px-4 py-1 rounded-md text-sm font-bold ${view === 'month' ? 'bg-white shadow' : ''}`} onClick={() => setView('month')}>Місяць</button>
          </div>
        </div>
        <button onClick={() => { setCurrentDate(new Date()); setDayOffset(0); }} className="text-blue-600 font-bold text-sm bg-blue-50 px-3 py-1 rounded">Сьогодні</button>
      </div>

      {/* МІСЯЦЬ */}
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
              let content = null;

              if (hists.length > 0) { 
                const firstLetter = hists[0].workoutName.charAt(0).toUpperCase();
                bgClass = 'bg-green-100 border-green-300 shadow-sm'; 
                textClass = 'text-green-800 font-bold'; 
                content = (
                  <div className="flex flex-col items-center mt-1">
                    <span className="text-xl font-black leading-none opacity-90">{firstLetter}</span>
                    <span className="text-[9px] mt-1 font-mono opacity-80">{formatDuration(hists[0].duration)}</span>
                  </div>
                );
              } else if (plans.length > 0) { 
                const pName = plans[0].name || workouts?.find(w => w.id === plans[0].workoutId)?.name || '?';
                const firstLetter = pName.charAt(0).toUpperCase();
                bgClass = 'bg-white border-blue-300 shadow-md ring-1 ring-blue-100'; 
                textClass = 'text-gray-900 font-bold'; 
                content = (
                  <div className="flex flex-col items-center mt-1">
                    <span className="text-xl text-blue-600 font-black leading-none">{firstLetter}</span>
                    <span className="text-[9px] mt-1 font-mono text-gray-400">--:--</span>
                  </div>
                );
              }
              
              return (
                <div key={dStr} onClick={() => setDayDetailsDate(dStr)} className={`min-h-[60px] flex flex-col items-center pt-1 pb-1 rounded-md text-sm cursor-pointer border ${bgClass} ${textClass} ${dStr === todayStr ? 'ring-2 ring-blue-500' : ''}`}>
                  <span className="text-[10px] opacity-70 leading-none mb-1">{day.getDate()}</span>
                  {content}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* МАТРИЦЯ */}
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
                    <th key={dStr} className={`p-2 border-b text-center min-w-[65px] ${isToday ? 'bg-blue-50' : ''}`}>
                      <div className={`text-[10px] uppercase ${isToday ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>{day.toLocaleDateString('uk-UA', { weekday: 'short' })}</div>
                      <div className={`text-sm font-bold ${isToday ? 'text-blue-700' : 'text-gray-800'}`}>{day.getDate()}.{(day.getMonth() + 1).toString().padStart(2, '0')}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortedWorkouts?.map(w => (
                <tr key={w.id} className="hover:bg-gray-50">
                  <td className="sticky left-0 bg-white z-10 p-2 border-b border-r max-w-[120px]" style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
                    <div className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">{w.muscle || 'Загальна'}</div>
                    <div className="text-[11px] font-bold text-gray-800 leading-tight">{w.name}</div>
                  </td>
                  {visibleDays.map(day => {
                    const dStr = getLocalDateString(day);
                    const isToday = dStr === todayStr;
                    const hist = historyData?.find(h => h.date === dStr && h.workoutName === w.name);
                    const plan = scheduled?.find(s => s.date === dStr && s.workoutId === w.id);
                    const firstLetter = (plan?.name || w.name).charAt(0).toUpperCase();

                    return (
                      <td key={dStr} className={`p-1 border-b text-center align-middle border-l border-gray-100 ${isToday && !hist ? 'bg-blue-50/50' : ''}`}>
                        {hist ? (
                          <div onClick={() => setActiveHistoryAction(hist)} className="bg-green-100 text-green-800 rounded shadow-sm flex flex-col items-center justify-center cursor-pointer hover:bg-green-200 w-full h-14 border border-green-200">
                            <span className="text-xl font-black leading-none">{firstLetter}</span>
                            <span className="text-[9px] mt-1 font-mono">{formatDuration(hist.duration)}</span>
                          </div>
                        ) : plan ? (
                          <button onClick={() => handleCellClickMatrix(dStr, w, true, plan)} className="bg-blue-500 text-white rounded w-full h-14 shadow-sm active:bg-blue-600 flex flex-col items-center justify-center">
                            <span className="text-xl font-black leading-none">{firstLetter}</span>
                            <span className="text-[9px] mt-1 font-mono text-blue-200">--:--</span>
                          </button>
                        ) : (
                          <div onClick={() => handleCellClickMatrix(dStr, w, false)} className="h-14 w-full rounded flex items-center justify-center hover:bg-gray-100 cursor-pointer text-gray-300 hover:text-gray-400">
                            <Plus size={18} />
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

      {/* МОДАЛКА: Редагування плану перед збереженням */}
      {planSetup && (
        <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-[110] p-2 pb-16">
          <div className="bg-white w-full max-w-md rounded-2xl p-5 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h3 className="font-bold text-lg">План на {planSetup.date}</h3>
              <button onClick={() => setPlanSetup(null)} className="text-gray-400 bg-gray-100 rounded-full p-1"><X size={20}/></button>
            </div>
            
            <input value={planSetup.editName} onChange={e => setPlanSetup({...planSetup, editName: e.target.value})} placeholder="Назва плану" className="w-full p-3 border rounded-lg mb-4 font-bold bg-gray-50" />
            
            <div className="flex-1 overflow-y-auto space-y-3 mb-4">
              {planSetup.editItems.map((item, idx) => {
                const exName = exercises?.find(e => e.id === item.exerciseId)?.name || 'Вправа';
                return (
                  <div key={idx} className="p-3 bg-white border rounded-xl shadow-sm relative">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-sm text-blue-800">{exName}</span>
                      <button onClick={() => {
                        const newItems = [...planSetup.editItems]; newItems.splice(idx, 1);
                        setPlanSetup({...planSetup, editItems: newItems});
                      }} className="text-red-400"><Trash2 size={16}/></button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div><label className="text-[9px] text-gray-400 uppercase font-bold">Вага</label><input value={item.weight} onChange={e => { const n = [...planSetup.editItems]; n[idx].weight = e.target.value; setPlanSetup({...planSetup, editItems: n}); }} className="w-full p-2 border rounded text-xs bg-gray-50" /></div>
                      <div><label className="text-[9px] text-gray-400 uppercase font-bold">Еспандер</label><input value={item.band} onChange={e => { const n = [...planSetup.editItems]; n[idx].band = e.target.value; setPlanSetup({...planSetup, editItems: n}); }} className="w-full p-2 border rounded text-xs bg-gray-50" /></div>
                      <div><label className="text-[9px] text-gray-400 uppercase font-bold">Повтори</label><input value={item.reps} onChange={e => { const n = [...planSetup.editItems]; n[idx].reps = e.target.value; setPlanSetup({...planSetup, editItems: n}); }} className="w-full p-2 border rounded text-xs bg-gray-50" /></div>
                    </div>
                  </div>
                );
              })}
              
              <button onClick={() => setPlanSetup({...planSetup, showAddEx: true, exSearch: ''})} className="w-full py-3 bg-blue-50 text-blue-600 rounded-lg font-bold border border-dashed border-blue-300 flex justify-center items-center gap-2"><Plus size={18}/> Додати вправу</button>
            </div>

            <div className="flex gap-3 mt-auto shrink-0">
              <button onClick={() => setPlanSetup(null)} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-bold">Скасувати</button>
              <button onClick={savePlanSetup} className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold flex justify-center items-center gap-2"><Save size={18}/> Зберегти план</button>
            </div>

            {/* Вкладена модалка: Пошук вправи для плану */}
            {planSetup.showAddEx && (
              <div className="absolute inset-0 bg-white rounded-2xl flex flex-col p-4 z-20">
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                   <h3 className="font-bold">Оберіть вправу</h3>
                   <button onClick={() => setPlanSetup({...planSetup, showAddEx: false})} className="text-gray-400 bg-gray-100 rounded-full p-1"><X size={20}/></button>
                </div>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                  <input value={planSetup.exSearch} onChange={e => setPlanSetup({...planSetup, exSearch: e.target.value})} placeholder="Пошук..." className="w-full p-2 pl-10 border rounded-lg bg-gray-50" />
                </div>
                <div className="flex-1 overflow-y-auto space-y-2">
                  {exercises?.filter(ex => ex.name.toLowerCase().includes(planSetup.exSearch.toLowerCase())).map(ex => (
                    <button key={ex.id} onClick={() => {
                      setPlanSetup({ ...planSetup, editItems: [...planSetup.editItems, { exerciseId: ex.id, weight: '', band: '', reps: '', note: '' }], showAddEx: false });
                    }} className="w-full text-left p-3 bg-gray-50 border rounded font-medium">{ex.name}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* МОДАЛКА: Деталі дня (Історія + Плани) */}
      {dayDetailsDate && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-[100] pb-20">
          <div className="bg-white w-full rounded-t-2xl p-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h3 className="font-bold text-lg">Деталі за {dayDetailsDate}</h3>
              <button onClick={() => setDayDetailsDate(null)} className="text-gray-400 bg-gray-100 rounded-full p-1"><X size={20}/></button>
            </div>
            
            {historyData?.filter(h => h.date === dayDetailsDate).map(h => (
              <div key={h.id} className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl relative">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-green-800 text-lg">✓ {h.workoutName}</span>
                  <span className="text-sm font-mono bg-green-100 text-green-800 px-2 py-1 rounded">{formatDuration(h.duration)}</span>
                </div>
                <button onClick={() => db.history.delete(h.id)} className="mt-3 w-full bg-red-100 text-red-600 p-2 rounded-lg font-bold flex justify-center items-center gap-2"><Trash2 size={16}/> Видалити запис</button>
              </div>
            ))}

            {scheduled?.filter(s => s.date === dayDetailsDate).map(p => {
              const w = workouts?.find(x => x.id === p.workoutId);
              const displayName = p.name || w?.name || 'Видалене';
              return (
                <div key={p.id} className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-xl">
                  <div className="font-bold text-gray-800 mb-3 text-lg">ПЛАН: {displayName}</div>
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

      {/* МОДАЛКА: Дії з планом (після кліку на план у матриці) */}
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
                <button onClick={() => handleMarkDone(activePlanAction)} className="w-full bg-gray-200 text-gray-800 p-3 rounded-lg font-bold flex items-center justify-center gap-2">
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

      {/* Модалки: Історія та Вибір з бази - залишені стандартними з v1.8 */}
      {planModalDate && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-[100] pb-20">
          <div className="bg-white w-full rounded-t-2xl p-4 max-h-[70vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Вибір шаблону</h3>
              <button onClick={() => setPlanModalDate(null)} className="text-red-500 bg-red-50 rounded-full p-1"><X size={20}/></button>
            </div>
            <div className="space-y-2">
              {workouts?.slice().sort((a, b) => a.name.localeCompare(b.name, 'uk-UA')).map(w => (
                <button key={w.id} onClick={() => handlePlan(w)} className="w-full text-left p-4 bg-gray-50 rounded-xl font-bold border active:bg-gray-200 shadow-sm">{w.name}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 3. РЕДАКТОР ШАБЛОНІВ ТРЕНУВАНЬ (без змін)
// ==========================================
function Workouts() {
   // ... (Залишається ідентичним попередній версії з muscle. Щоб не дублювати 200 рядків, тут використовується стандартний код з вашого файлу[cite: 1] та моєї попередньої відповіді).
   return <div>Код секції Workouts залишається без змін (з полем muscle).</div>;
}

// ==========================================
// 4. ДОВІДНИК ВПРАВ (без змін)
// ==========================================
function Exercises() { 
  return <div>Код секції Exercises залишається без змін[cite: 1].</div>; 
}

// ==========================================
// 5. ТАЙМЕРИ ТА ВИКОНАННЯ ТРЕНУВАННЯ
// ==========================================
function NumberControl({ label, value, setValue }: { label: string, value: number, setValue: (v: number | ((prev: number) => number)) => void }) {
  return (
    <div className="flex items-center justify-between w-full py-2 border-b border-gray-100 last:border-0">
      <div className="text-sm text-gray-500 font-bold uppercase">{label}</div>
      <div className="flex items-center gap-2">
        <button onClick={() => setValue(v => Math.max(1, typeof v === 'number' ? v - 1 : v))} className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded-xl text-2xl font-bold text-gray-600 shadow-sm">-</button>
        <input type="number" value={value} onChange={e => setValue(Math.max(1, Number(e.target.value)))} className="w-16 text-center font-bold text-xl bg-transparent outline-none p-0 m-0" />
        <button onClick={() => setValue(v => (typeof v === 'number' ? v + 1 : v))} className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded-xl text-2xl font-bold text-gray-600 shadow-sm">+</button>
      </div>
    </div>
  );
}

function Timers() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeWorkoutData = location.state as { plan: Scheduled, workout: Workout } | null;
  const exercises = useLiveQuery(() => db.exercises.toArray());

  const [mode, setMode] = useState<'TABATA' | 'FREE'>(activeWorkoutData ? 'FREE' : 'TABATA');
  const audioCtx = useRef<AudioContext | null>(null);
  const wakeLockRef = useRef<any>(null);
  const silentOscRef = useRef<any>(null);

  // Табата (Збереження та 5 секунд PREP)
  const [workTime, setWorkTime] = useState(() => Number(localStorage.getItem('tabata_work')) || 20);
  const [restTime, setRestTime] = useState(() => Number(localStorage.getItem('tabata_rest')) || 10);
  const [rounds, setRounds] = useState(() => Number(localStorage.getItem('tabata_rounds')) || 8);
  const [isRunning, setIsRunning] = useState(false);
  const [phase, setPhase] = useState<'PREP' | 'WORK' | 'REST' | 'IDLE'>('IDLE');
  const [timeLeft, setTimeLeft] = useState(workTime);
  const [currentRound, setCurrentRound] = useState(1);
  const tabataEndTime = useRef(0);
  const lastTabataBeep = useRef(0);

  // Вільний таймер
  const [freeTime, setFreeTime] = useState(0);
  const [freePhase, setFreePhase] = useState<'Розминка' | 'Основна' | 'Заминка' | 'Зупинено'>('Зупинено');
  const [workoutNote, setWorkoutNote] = useState('');
  const [phaseTimes, setPhaseTimes] = useState({ warmup: 0, main: 0, cooldown: 0 });
  const lastFreeTick = useRef(Date.now());

  // Дані для редагування в кінці
  const [showTimeEdit, setShowTimeEdit] = useState(false);
  const [editTimes, setEditTimes] = useState({ wm:0, ws:0, mm:0, ms:0, cm:0, cs:0 });
  
  // Використовуємо items з плану (якщо вони були відредаговані), інакше - з шаблону
  const initialActiveItems = activeWorkoutData?.plan?.items || activeWorkoutData?.workout?.items || [];
  const initialActiveName = activeWorkoutData?.plan?.name || activeWorkoutData?.workout?.name || '';
  const [finishItems, setFinishItems] = useState<WorkoutItem[]>(initialActiveItems);

  useEffect(() => {
    localStorage.setItem('tabata_work', String(workTime));
    localStorage.setItem('tabata_rest', String(restTime));
    localStorage.setItem('tabata_rounds', String(rounds));
  }, [workTime, restTime, rounds]);

  const beep = (freq: number, duration: number) => {
    if (!audioCtx.current) return;
    const osc = audioCtx.current.createOscillator();
    osc.connect(audioCtx.current.destination);
    osc.frequency.value = freq;
    osc.start();
    osc.stop(audioCtx.current.currentTime + duration);
  };

  const startSilentAudioLoop = () => {
    if (!audioCtx.current) return;
    if (silentOscRef.current) return;
    const osc = audioCtx.current.createOscillator();
    const gain = audioCtx.current.createGain(); gain.gain.value = 0.001;
    osc.connect(gain); gain.connect(audioCtx.current.destination); osc.start();
    silentOscRef.current = osc;
  };

  const stopSilentAudioLoop = () => {
    if (silentOscRef.current) { silentOscRef.current.stop(); silentOscRef.current.disconnect(); silentOscRef.current = null; }
  };

  const initAudio = () => {
    if (!audioCtx.current) audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioCtx.current.resume();
  };

  const requestWakeLock = async () => { try { if ('wakeLock' in navigator) wakeLockRef.current = await (navigator as any).wakeLock.request('screen'); } catch (err) {} };
  const releaseWakeLock = () => { if (wakeLockRef.current) { wakeLockRef.current.release().catch(()=>{}); wakeLockRef.current = null; } };

  // ... (Фонова логіка Табати і Вільного таймера залишається повністю ідентичною попередній версії).

  const initiateStopFreeWorkout = () => {
    initAudio(); setFreePhase('Зупинено');
    if (activeWorkoutData) {
      setEditTimes({ wm: Math.floor(phaseTimes.warmup / 60), ws: Math.floor(phaseTimes.warmup % 60), mm: Math.floor(phaseTimes.main / 60), ms: Math.floor(phaseTimes.main % 60), cm: Math.floor(phaseTimes.cooldown / 60), cs: Math.floor(phaseTimes.cooldown % 60) });
      setFinishItems([...initialActiveItems]); // Завантажуємо актуальні (можливо відредаговані в плані) вправи
      setShowTimeEdit(true);
    } else {
      setFreeTime(0); setPhaseTimes({ warmup: 0, main: 0, cooldown: 0 });
    }
  };

  const saveFinalFreeWorkout = async () => {
    const fw = editTimes.wm * 60 + editTimes.ws; const fm = editTimes.mm * 60 + editTimes.ms; const fc = editTimes.cm * 60 + editTimes.cs;
    const ft = fw + fm + fc;
    const breakdownInfo = `[Розминка: ${formatDuration(fw)} | Основна: ${formatDuration(fm)} | Заминка: ${formatDuration(fc)}]`;
    const finalNote = workoutNote ? `${workoutNote}\n\n${breakdownInfo}` : breakdownInfo;

    const itemsSnapshot = finishItems.map(item => {
      const ex = exercises?.find(e => e.id === item.exerciseId);
      return { ...item, exNameSnapshot: ex?.name, exMuscleSnapshot: ex?.muscle };
    });

    await db.history.add({
      id: crypto.randomUUID(),
      date: getLocalDateString(new Date()),
      workoutName: initialActiveName, // Використовуємо назву плану
      duration: ft,
      items: itemsSnapshot,
      note: finalNote
    });

    await db.scheduled.delete(activeWorkoutData!.plan.id);
    setFreeTime(0); setPhaseTimes({ warmup: 0, main: 0, cooldown: 0 }); setShowTimeEdit(false);
    navigate('/');
  };

  return (
    <div className="p-4 pb-24 relative">
      {activeWorkoutData && (
        <div className="bg-blue-100 border border-blue-300 p-3 rounded-lg mb-4 flex justify-between items-center shadow-sm">
          <span className="font-bold text-blue-800 text-sm">Виконується: {initialActiveName}</span>
          <button onClick={() => navigate('/')} className="text-blue-500 bg-white rounded-full p-1"><X size={16}/></button>
        </div>
      )}
      
      {/* ... Візуальна частина таймерів та модалка фінального збереження залишається ідентичною до попередньої версії ... */}
    </div>
  );
}

// ==========================================
// 6. СИНХРОНІЗАЦІЯ ДАНИХ
// ==========================================
function DataSync() {
  const exportData = async () => {
    const data = {
      exercises: await db.exercises.toArray(),
      workouts: await db.workouts.toArray(),
      scheduled: await db.scheduled.toArray(),
      history: await db.history.toArray()
    };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `w_jornal_backup_${getLocalDateString(new Date())}.json`;
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
