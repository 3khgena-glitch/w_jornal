import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Dumbbell, Timer as TimerIcon, Calendar as CalendarIcon, Activity, Plus, Settings,
  Trash2, Edit2, Save, X, ChevronLeft, ChevronRight, Play, CheckCircle2,
  ChevronUp, ChevronDown, Search, Copy, Download
} from 'lucide-react';
import Dexie, { Table } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';

// ==========================================
// 1. БАЗА ДАНИХ ТА УТИЛІТИ
// ==========================================
export interface Exercise { id: string; name: string; category: string; muscle?: string; }
export interface WorkoutItem { exerciseId: string; weight: string; band: string; reps: string; note: string; exNameSnapshot?: string; exMuscleSnapshot?: string; }
export interface Workout { id: string; name: string; muscle?: string; items: WorkoutItem[]; note: string; }
export interface Scheduled { id: string; date: string; workoutId: string; name?: string; items?: WorkoutItem[]; isCompleted: boolean; }
export interface History { id: string; date: string; workoutId?: string; workoutName: string; duration: number; items: WorkoutItem[]; note?: string; }

export class WorkoutJournalDB extends Dexie {
  exercises!: Table<Exercise, string>;
  workouts!: Table<Workout, string>;
  scheduled!: Table<Scheduled, string>;
  history!: Table<History, string>;
  constructor() {
    super('WJornalDB_v7');
    this.version(2).stores({ exercises: 'id, name, category, muscle', workouts: 'id, name, muscle', scheduled: 'id, date, workoutId', history: 'id, date, workoutId' });
  }
}
export const db = new WorkoutJournalDB();

const MUSCLE_GROUPS = ['Груди', 'Ноги', 'Спина', 'Плечі', 'Руки', 'Загальна'];
const generateId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
const formatDuration = (s: number) => (!s || s <= 0 ? '--:--' : `${Math.floor(s / 60)}:${Math.floor(s \% 60).toString().padStart(2, '0')}`); const getLocalDateString = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const getMondayOfWeek = (d: Date) => { const r = new Date(d.getFullYear(), d.getMonth(), d.getDate()); r.setDate(r.getDate() - ((r.getDay() + 6) % 7)); return r; };

const initialExercises = [
  { category: 'МИНОТАВР', name: 'ГОБЛЕТ-присидання', muscle: 'Ноги' }, { category: 'МИНОТАВР', name: 'ПРОТЯЖКА до подборіддя', muscle: 'Плечі' },
  { category: 'МИНОТАВР', name: 'МАХИ 2 руками', muscle: 'Загальна' }, { category: 'МИНОТАВР', name: 'ТЯГА В НАКЛОНІ до поясу', muscle: 'Спина' },
  { category: 'МИНОТАВР', name: 'СТАНОВА ТЯГА з гірею', muscle: 'Спина' }, { category: 'НОГИ', name: 'ПРИСІДАННЯ з ЕСПАНДЕРОМ', muscle: 'Ноги' },
  { category: 'ДРАБИНА з ГИРЕЮ', name: 'ВІДЖИМАННЯ', muscle: 'Груди' }, { category: 'ТРАСТЕР', name: 'ТРАСТЕР з еспандером', muscle: 'Загальна' },
  { category: 'БРУСИ', name: 'ВІДЖИМАННЯ на брусах', muscle: 'Груди' }, { category: 'ДЕЛЬТИ', name: 'ПРОТЯЖКА до подборіддя еспандер', muscle: 'Плечі' },
  { category: 'ДЕЛЬТИ', name: 'ЖИМ ЕСПАНДЕРА над головою', muscle: 'Плечі' }, { category: 'ДЕЛЬТИ', name: 'РОЗВЕДЕННЯ ЕСПАНДЕРА В СТОРОНИ', muscle: 'Плечі' },
  { category: 'СПИНА', name: 'ПІДТЯГУВАННЯ', muscle: 'Спина' }, { category: 'СПИНА', name: 'СТАНОВА ТЯГА з еспандером', muscle: 'Спина' }
];
const initialWorkouts = [
  { name: 'МИНОТАВР', muscle: 'Загальна', exercises: ['ГОБЛЕТ-присидання', 'ПРОТЯЖКА до подборіддя', 'МАХИ 2 руками', 'ТЯГА В НАКЛОНІ до поясу', 'СТАНОВА ТЯГА з гірею'] },
  { name: 'НОГИ', muscle: 'Ноги', exercises: ['ПРИСІДАННЯ з ЕСПАНДЕРОМ'] },
  { name: 'ДРАБИНА з ГИРЕЮ', muscle: 'Загальна', exercises: ['МАХИ 2 руками', 'ГОБЛЕТ-присидання', 'ВІДЖИМАННЯ'] },
  { name: 'БРУСИ (важко)', muscle: 'Груди', exercises: ['ВІДЖИМАННЯ на брусах'] },
  { name: 'ДЕЛЬТИ', muscle: 'Плечі', exercises: ['ПРОТЯЖКА до подборіддя еспандер', 'ЖИМ ЕСПАНДЕРА над головою', 'РОЗВЕДЕННЯ ЕСПАНДЕРА В СТОРОНИ'] },
  { name: 'СПИНА', muscle: 'Спина', exercises: ['ПІДТЯГУВАННЯ', 'СТАНОВА ТЯГА з еспандером'] }
];

// ==========================================
// 2. МОДАЛКА ВИБОРУ / СТВОРЕННЯ ВПРАВИ
// ==========================================
function ExercisePickerModal({ exercises, onSelect, onClose }: { exercises?: Exercise[]; onSelect: (ex: Exercise) => void; onClose: () => void; }) {
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMuscle, setNewMuscle] = useState('Загальна');

  const filtered = (exercises || [])
    .filter(ex => ex.name.toLowerCase().includes(search.toLowerCase()) || (ex.muscle && ex.muscle.toLowerCase().includes(search.toLowerCase())))
    .sort((a, b) => a.name.localeCompare(b.name, 'uk-UA'));

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const newEx: Exercise = { id: generateId(), name: trimmed, category: 'Користувацькі', muscle: newMuscle };
    await db.exercises.add(newEx);
    onSelect(newEx);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-[120] pb-20">
      <div className="bg-white w-full rounded-t-2xl p-4 h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-3 border-b pb-2 shrink-0">
          <h3 className="font-bold text-lg">{creating ? 'Нова вправа в довідник' : 'Оберіть вправу'}</h3>
          <button onClick={onClose} className="text-gray-400 bg-gray-100 rounded-full p-1"><X size={20} /></button>
        </div>
        {creating ? (
          <div className="space-y-3 pt-2">
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Назва вправи..." className="w-full p-3 border rounded-lg bg-gray-50 font-medium" autoFocus />
            <select value={newMuscle} onChange={e => setNewMuscle(e.target.value)} className="w-full p-3 border rounded-lg bg-white font-medium">
              {MUSCLE_GROUPS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setCreating(false)} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-bold">Назад</button>
              <button onClick={handleCreate} className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold">Зберегти і додати</button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-3 shrink-0 relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={18} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Пошук (назва або група)..." className="w-full p-2 pl-10 border rounded-lg bg-gray-50" />
            </div>
            <button onClick={() => { setNewName(search.trim()); setCreating(true); }} className="w-full mb-3 py-2.5 bg-blue-50 text-blue-600 rounded-lg font-bold border border-dashed border-blue-300 flex items-center justify-center gap-2 shrink-0 text-sm">
              <Plus size={18} /> {search.trim() ? `Створити «${search.trim()}»` : 'Створити нову вправу'} </button> <div className="space-y-2 overflow-y-auto flex-1 pb-4"> {filtered.map(ex => ( <button key={ex.id} onClick={() => onSelect(ex)} className="w-full text-left p-3 bg-gray-50 border rounded-lg font-medium active:bg-gray-200 flex justify-between items-center"> <span className="pr-2">{ex.name}</span> <span className="text-[10px] text-gray-400 uppercase font-bold shrink-0">{ex.muscle \vert{}\vert{} 'Загальна'}</span> </button> ))} </div> </> )} </div> </div> ); }  // ========================================== // 3. КОНТЕКСТ ТАЙМЕРІВ // ========================================== const TimerContext = createContext<any>(null); export const useTimer = () => useContext(TimerContext);  export function TimerProvider({ children }: { children: React.ReactNode }) { const location = useLocation(); const navigate = useNavigate(); const [savedWorkoutData, setSavedWorkoutData] = useState<{ plan: Scheduled; workout: Workout } \vert{} null>(null); const [finishItems, setFinishItems] = useState<WorkoutItem[]>([]); const [mode, setMode] = useState<'TABATA' \vert{} 'FREE'>(localStorage.getItem('active_workout_backup') ? 'FREE' : 'TABATA');  useEffect(() => { if (location.pathname === '/timer' && location.state) { const data = location.state as any; setSavedWorkoutData(data); setMode('FREE'); localStorage.setItem('active_workout_backup', JSON.stringify(data)); setFinishItems((data.plan?.items \vert{}\vert{} data.workout?.items \vert{}\vert{} []).map((i: any) => ({ ...i }))); navigate('/timer', { replace: true, state: null }); } else if (!savedWorkoutData) { const backup = localStorage.getItem('active_workout_backup'); if (backup) { try { const parsed = JSON.parse(backup); setSavedWorkoutData(parsed); setFinishItems((parsed.plan?.items \vert{}\vert{} parsed.workout?.items \vert{}\vert{} []).map((i: any) => ({ ...i }))); } catch {} } } }, [location.pathname, location.state, navigate]);  const audioCtx = useRef<AudioContext \vert{} null>(null); const wakeLockRef = useRef<any>(null); const silentOscRef = useRef<any>(null);  const [workTime, setWorkTime] = useState<number \vert{} ''>(() => Number(localStorage.getItem('tabata_work')) \vert{}\vert{} 20); const [restTime, setRestTime] = useState<number \vert{} ''>(() => Number(localStorage.getItem('tabata_rest')) \vert{}\vert{} 10); const [rounds, setRounds] = useState<number \vert{} ''>(() => Number(localStorage.getItem('tabata_rounds')) \vert{}\vert{} 8); const [isRunning, setIsRunning] = useState(false); const [phase, setPhase] = useState<'PREP' \vert{} 'WORK' \vert{} 'REST' \vert{} 'IDLE'>('IDLE'); const [timeLeft, setTimeLeft] = useState(Number(workTime) \vert{}\vert{} 20); const [currentRound, setCurrentRound] = useState(1); const tabataEndTime = useRef(0); const lastTabataBeep = useRef(0);  const [freeTime, setFreeTime] = useState(0); const [freePhase, setFreePhase] = useState<'Розминка' \vert{} 'Основна' \vert{} 'Заминка' \vert{} 'Зупинено'>('Зупинено'); const [workoutNote, setWorkoutNote] = useState(''); const [phaseTimes, setPhaseTimes] = useState({ warmup: 0, main: 0, cooldown: 0 }); const lastFreeTick = useRef(Date.now());  const [freeRestTime, setFreeRestTime] = useState<number \vert{} ''>(() => Number(localStorage.getItem('free_rest_time')) \vert{}\vert{} 60); const [freeRestTimeLeft, setFreeRestTimeLeft] = useState(Number(freeRestTime) \vert{}\vert{} 60); const [isFreeResting, setIsFreeResting] = useState(false); const freeRestEndTime = useRef(0); const lastFreeRestBeep = useRef(0);  const [showTimeEdit, setShowTimeEdit] = useState(false); const [editTimes, setEditTimes] = useState({ wm: 0, ws: 0, mm: 0, ms: 0, cm: 0, cs: 0 }); const [showFinishAddEx, setShowFinishAddEx] = useState(false); const activeName = savedWorkoutData?.plan?.name \vert{}\vert{} savedWorkoutData?.workout?.name \vert{}\vert{} '';  useEffect(() => { if (typeof workTime === 'number') localStorage.setItem('tabata_work', String(workTime)); if (typeof restTime === 'number') localStorage.setItem('tabata_rest', String(restTime)); if (typeof rounds === 'number') localStorage.setItem('tabata_rounds', String(rounds)); if (typeof freeRestTime === 'number') localStorage.setItem('free_rest_time', String(freeRestTime)); }, [workTime, restTime, rounds, freeRestTime]);  const beep = (freq: number, dur: number) => { if (!audioCtx.current) return; const osc = audioCtx.current.createOscillator(); osc.connect(audioCtx.current.destination); osc.frequency.value = freq; osc.start(); osc.stop(audioCtx.current.currentTime + dur); }; const startSilent = () => { if (!audioCtx.current \vert{}\vert{} silentOscRef.current) return; const osc = audioCtx.current.createOscillator(); const gain = audioCtx.current.createGain(); gain.gain.value = 0.001; osc.connect(gain); gain.connect(audioCtx.current.destination); osc.start(); silentOscRef.current = osc; }; const stopSilent = () => { if (silentOscRef.current) { silentOscRef.current.stop(); silentOscRef.current.disconnect(); silentOscRef.current = null; } }; const initAudio = () => { if (!audioCtx.current) audioCtx.current = new (window.AudioContext \vert{}\vert{} (window as any).webkitAudioContext)(); audioCtx.current.resume(); }; const reqWL = async () => { try { if ('wakeLock' in navigator) wakeLockRef.current = await (navigator as any).wakeLock.request('screen'); } catch {} }; const relWL = () => { if (wakeLockRef.current) { wakeLockRef.current.release().catch(() => {}); wakeLockRef.current = null; } };  useEffect(() => { const onVis = () => { if (document.visibilityState === 'visible' && (isRunning \vert{}\vert{} freePhase !== 'Зупинено')) reqWL(); }; document.addEventListener('visibilitychange', onVis); return () => document.removeEventListener('visibilitychange', onVis); }, [isRunning, freePhase]);  useEffect(() => { if (phase === 'IDLE') setTimeLeft(Number(workTime) \vert{}\vert{} 20); }, [workTime, phase]);  useEffect(() => { let t: number; const sw = Number(workTime) \vert{}\vert{} 20, sr = Number(restTime) \vert{}\vert{} 10, rnd = Number(rounds) \vert{}\vert{} 8; if (isRunning) { t = window.setInterval(() => { const rem = Math.ceil((tabataEndTime.current - Date.now()) / 1000); if (rem <= 3 && rem > 0 && lastTabataBeep.current !== rem) { beep(800, 0.1); lastTabataBeep.current = rem; } if (rem <= 0) { lastTabataBeep.current = 0; if (phase === 'PREP') { setPhase('WORK'); beep(1200, 0.5); tabataEndTime.current = Date.now() + sw * 1000; } else if (phase === 'WORK') { if (currentRound >= rnd) { setIsRunning(false); setPhase('IDLE'); beep(400, 1); relWL(); stopSilent(); } else { setPhase('REST'); beep(1200, 0.5); tabataEndTime.current = Date.now() + sr * 1000; } } else if (phase === 'REST') { setPhase('WORK'); setCurrentRound(r => r + 1); beep(1200, 0.5); tabataEndTime.current = Date.now() + sw * 1000; } } else setTimeLeft(rem); }, 100); } return () => clearInterval(t); }, [isRunning, phase, currentRound, rounds, workTime, restTime]);  const toggleTabata = () => { initAudio(); if (!isRunning && phase === 'IDLE') { reqWL(); startSilent(); setPhase('PREP'); setCurrentRound(1); tabataEndTime.current = Date.now() + 5000; } else if (!isRunning) { reqWL(); startSilent(); tabataEndTime.current = Date.now() + timeLeft * 1000; } else { relWL(); stopSilent(); } setIsRunning(!isRunning); }; const resetTabata = () => { setPhase('IDLE'); setIsRunning(false); relWL(); stopSilent(); };  useEffect(() => { let t: number; if (freePhase !== 'Зупинено') { lastFreeTick.current = Date.now(); t = window.setInterval(() => { const now = Date.now(), d = (now - lastFreeTick.current) / 1000; lastFreeTick.current = now; setFreeTime(p => p + d); setPhaseTimes(p => freePhase === 'Розминка' ? { ...p, warmup: p.warmup + d } : freePhase === 'Основна' ? { ...p, main: p.main + d } : { ...p, cooldown: p.cooldown + d }); }, 1000); } return () => clearInterval(t); }, [freePhase]);  useEffect(() => { let t: number; if (isFreeResting) { t = window.setInterval(() => { const rem = Math.ceil((freeRestEndTime.current - Date.now()) / 1000); if (rem <= 5 && rem > 0 && lastFreeRestBeep.current !== rem) { beep(800, 0.1); lastFreeRestBeep.current = rem; } if (rem <= 0) { beep(1200, 0.5); setIsFreeResting(false); lastFreeRestBeep.current = 0; } else setFreeRestTimeLeft(rem); }, 100); } return () => clearInterval(t); }, [isFreeResting]);  const toggleFreeRest = () => { initAudio(); if (!isFreeResting) { const s = Number(freeRestTime) \vert{}\vert{} 60; setFreeRestTimeLeft(s); freeRestEndTime.current = Date.now() + s * 1000; setIsFreeResting(true); } else setIsFreeResting(false); };  const startFreePhase = (np: 'Розминка' \vert{} 'Основна' \vert{} 'Заминка') => { initAudio(); reqWL(); startSilent(); setFreePhase(np); }; const initiateStopFreeWorkout = () => { initAudio(); relWL(); stopSilent(); setIsFreeResting(false); setFreePhase('Зупинено'); if (savedWorkoutData) { setEditTimes({ wm: Math.floor(phaseTimes.warmup / 60), ws: Math.floor(phaseTimes.warmup \% 60), mm: Math.floor(phaseTimes.main / 60), ms: Math.floor(phaseTimes.main \% 60), cm: Math.floor(phaseTimes.cooldown / 60), cs: Math.floor(phaseTimes.cooldown \% 60) }); setShowTimeEdit(true); } else { setFreeTime(0); setPhaseTimes({ warmup: 0, main: 0, cooldown: 0 }); } };  const clearActiveWorkout = () => { if (!window.confirm('Скасувати поточне тренування?')) return; localStorage.removeItem('active_workout_backup'); setSavedWorkoutData(null); setFreeTime(0); setPhaseTimes({ warmup: 0, main: 0, cooldown: 0 }); setFreePhase('Зупинено'); navigate('/'); };  const updateFinishItem = (idx: number, field: keyof WorkoutItem, val: string) => { const n = finishItems.map(i => ({ ...i })); n[idx] = { ...n[idx], [field]: val }; setFinishItems(n); };  const saveFinalFreeWorkout = async () => { const fw = editTimes.wm * 60 + editTimes.ws, fm = editTimes.mm * 60 + editTimes.ms, fc = editTimes.cm * 60 + editTimes.cs; const breakdown = `[Розминка: ${formatDuration(fw)} | Основна: ${formatDuration(fm)} \vert{} Заминка: ${formatDuration(fc)}]`;
    const allExs = await db.exercises.toArray();
    const snapItems = finishItems.map(it => { const ex = allExs.find(e => e.id === it.exerciseId); return { ...it, exNameSnapshot: ex?.name, exMuscleSnapshot: ex?.muscle }; });
    await db.history.add({
      id: generateId(), date: savedWorkoutData?.plan?.date || getLocalDateString(new Date()),
      workoutId: savedWorkoutData?.plan?.workoutId || savedWorkoutData?.workout?.id, workoutName: activeName,
      duration: fw + fm + fc, items: snapItems, note: workoutNote ? `${workoutNote}\n\n${breakdown}` : breakdown
    });
    if (savedWorkoutData?.plan?.id) await db.scheduled.delete(savedWorkoutData.plan.id);
    localStorage.removeItem('active_workout_backup');
    setSavedWorkoutData(null); setFreeTime(0); setPhaseTimes({ warmup: 0, main: 0, cooldown: 0 }); setWorkoutNote(''); setShowTimeEdit(false); navigate('/');
  };

  return (
    <TimerContext.Provider value={{
      mode, setMode, savedWorkoutData, activeName, workTime, setWorkTime, restTime, setRestTime, rounds, setRounds,
      isRunning, phase, timeLeft, currentRound, toggleTabata, resetTabata, freeTime, freePhase, phaseTimes,
      freeRestTime, setFreeRestTime, freeRestTimeLeft, isFreeResting, toggleFreeRest, startFreePhase,
      initiateStopFreeWorkout, clearActiveWorkout, showTimeEdit, setShowTimeEdit, editTimes, setEditTimes,
      finishItems, setFinishItems, updateFinishItem, workoutNote, setWorkoutNote, saveFinalFreeWorkout, showFinishAddEx, setShowFinishAddEx
    }}>{children}</TimerContext.Provider>
  );
}

// ==========================================
// 4. КАЛЕНДАР (МАТРИЦЯ 7 ДНІВ + МІСЯЦЬ 6 ТИЖНІВ)
// ==========================================
function CalendarView() {
  const navigate = useNavigate();
  const [view, setView] = useState<'matrix' | 'month'>('matrix');
  const [dayOffset, setDayOffset] = useState(0);
  // Початок 6-тижневого вікна (понеділок першого тижня обраного місяця)
  const [monthStartMonday, setMonthStartMonday] = useState<Date>(() => {
    const now = new Date();
    return getMondayOfWeek(new Date(now.getFullYear(), now.getMonth(), 1));
  });

  const scheduled = useLiveQuery(() => db.scheduled.toArray());
  const historyData = useLiveQuery(() => db.history.toArray());
  const workouts = useLiveQuery(() => db.workouts.toArray());
  const exercises = useLiveQuery(() => db.exercises.toArray());

  const [planModalDate, setPlanModalDate] = useState<string | null>(null);
  const [dayDetailsDate, setDayDetailsDate] = useState<string | null>(null);
  const [activePlanAction, setActivePlanAction] = useState<Scheduled | null>(null);
  const [activeHistoryAction, setActiveHistoryAction] = useState<History | null>(null);
  const [planSetup, setPlanSetup] = useState<{ date: string; baseWorkoutId: string; editName: string; editItems: WorkoutItem[]; showAddEx: boolean; } | null>(null);
  const [planNote, setPlanNote] = useState('');

  const touchStart = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => { if (!activePlanAction) setPlanNote(''); }, [activePlanAction]);

  const todayStr = getLocalDateString(new Date());

  // 7 видимих днів для матриці
  const visibleDays = Array.from({ length: 7 }).map((_, i) => { const d = new Date(); d.setDate(d.getDate() + dayOffset + i - 5); return d; });
  const visibleDateStrings = visibleDays.map(getLocalDateString);

  // Рівно 6 тижнів (42 дні) для вкладки "Місяць"
  const sixWeeks: Date[][] = Array.from({ length: 6 }).map((_, w) =>
    Array.from({ length: 7 }).map((__, d) => {
      const dt = new Date(monthStartMonday);
      dt.setDate(monthStartMonday.getDate() + w * 7 + d);
      return dt;
    })
  );
  // Основний місяць у 6-тижневому вікні (беремо середину сітки — 3-й тиждень)
  const midDate = sixWeeks[2][3];
  const primaryMonth = midDate.getMonth();
  const primaryYear = midDate.getFullYear();

  const shiftMonthWeeks = (weeksDelta: number) => {
    setMonthStartMonday(prev => { const n = new Date(prev); n.setDate(n.getDate() + weeksDelta * 7); return n; });
  };

  // Свайп вліво/вправо для Таблиці
  const onMatrixTouchStart = (e: React.TouchEvent) => { touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onMatrixTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      const shift = Math.min(7, Math.max(1, Math.round(Math.abs(dx) / 55)));
      setDayOffset(p => p + (dx < 0 ? shift : -shift));
    }
  };

  // Свайп вгору/вниз для Місяця (зсув на 1-2 тижні)
  const onMonthTouchStart = (e: React.TouchEvent) => { touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onMonthTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dy) > 40 && Math.abs(dy) > Math.abs(dx) * 1.2) {
      const weeksShift = Math.min(4, Math.max(1, Math.round(Math.abs(dy) / 70)));
      shiftMonthWeeks(dy < 0 ? weeksShift : -weeksShift);
    }
  };

  const initiatePlanSetup = (date: string, w: Workout) => {
    setPlanSetup({ date, baseWorkoutId: w.id, editName: w.name, editItems: (w.items || []).map(i => ({ ...i })), showAddEx: false });
  };
  const savePlanSetup = async () => {
    if (!planSetup) return;
    await db.scheduled.add({ id: generateId(), date: planSetup.date, workoutId: planSetup.baseWorkoutId, name: planSetup.editName, items: planSetup.editItems, isCompleted: false });
    setPlanSetup(null);
  };
  const handleMarkDone = async (plan: Scheduled) => {
    const w = workouts?.find(x => x.id === plan.workoutId);
    await db.history.add({ id: generateId(), date: plan.date, workoutId: plan.workoutId, workoutName: plan.name || w?.name || 'Невідомо', duration: 0, items: plan.items || w?.items || [], note: planNote });
    await db.scheduled.delete(plan.id);
    setActivePlanAction(null);
  };
  const handleStart = (plan: Scheduled, workout: Workout) => { setActivePlanAction(null); navigate('/timer', { state: { plan, workout } }); };
  const handleCellClickMatrix = (dStr: string, w: Workout, isPlanned: boolean, planObj?: Scheduled) => {
    if (isPlanned && planObj) setActivePlanAction(planObj); else initiatePlanSetup(dStr, w);
  };

  const sortedWorkouts = workouts?.slice().sort((a, b) => a.name.localeCompare(b.name, 'uk-UA'));
  const activeWorkoutsInPeriod = sortedWorkouts?.filter(w =>
    historyData?.some(h => visibleDateStrings.includes(h.date) && (h.workoutId === w.id || h.workoutName === w.name)) ||
    scheduled?.some(s => visibleDateStrings.includes(s.date) && s.workoutId === w.id)
  );

  return (
    <div className="p-1.5 pb-24">
      <div className="flex justify-between items-center mb-3 px-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded">v3.3</span>
          <div className="flex bg-gray-200 rounded-lg p-0.5">
            <button className={`px-3 py-1 rounded-md text-xs font-bold ${view === 'matrix' ? 'bg-white shadow' : ''}`} onClick={() => setView('matrix')}>Таблиця</button>
            <button className={`px-3 py-1 rounded-md text-xs font-bold ${view === 'month' ? 'bg-white shadow' : ''}`} onClick={() => setView('month')}>Місяць</button>
          </div>
        </div>
        <button
          onClick={() => { const n = new Date(); setDayOffset(0); setMonthStartMonday(getMondayOfWeek(new Date(n.getFullYear(), n.getMonth(), 1))); }}
          className="text-blue-600 font-bold text-xs bg-blue-50 px-3 py-1.5 rounded-lg"
        >Сьогодні</button>
      </div>

      {/* ВКЛАДКА МІСЯЦЬ (РІВНО 6 ТИЖНІВ, ЧІТКЕ РОЗДІЛЕННЯ МІСЯЦІВ, СВАЙП ВГОРУ/ВНИЗ) */}
      {view === 'month' && (
        <div className="bg-white rounded-xl shadow-sm p-2.5 mx-0.5 touch-none" onTouchStart={onMonthTouchStart} onTouchEnd={onMonthTouchEnd}>
          <div className="flex items-center gap-1.5 mb-2.5">
            <select
              value={primaryMonth}
              onChange={e => setMonthStartMonday(getMondayOfWeek(new Date(primaryYear, Number(e.target.value), 1)))}
              className="p-2 border rounded-lg font-bold bg-gray-50 flex-1 text-sm capitalize"
            >
              {Array.from({ length: 12 }).map((_, i) => <option key={i} value={i}>{new Date(2000, i).toLocaleDateString('uk-UA', { month: 'long' })}</option>)}
            </select>
            <select
              value={primaryYear}
              onChange={e => setMonthStartMonday(getMondayOfWeek(new Date(Number(e.target.value), primaryMonth, 1)))}
              className="p-2 border rounded-lg font-bold bg-gray-50 w-20 text-sm"
            >
              {[2024, 2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <div className="flex flex-col gap-0.5">
              <button onClick={() => shiftMonthWeeks(-1)} className="px-2 py-0.5 bg-gray-100 rounded text-gray-600 active:bg-gray-200"><ChevronUp size={14} /></button>
              <button onClick={() => shiftMonthWeeks(1)} className="px-2 py-0.5 bg-gray-100 rounded text-gray-600 active:bg-gray-200"><ChevronDown size={14} /></button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] mb-1.5 text-gray-500 font-bold border-b pb-1">
            <div>Пн</div><div>Вт</div><div>Ср</div><div>Чт</div><div>Пт</div><div>Сб</div><div>Нд</div>
          </div>

          <div className="space-y-1.5">
            {sixWeeks.map((week, wIdx) => (
              <div key={wIdx} className="grid grid-cols-7 gap-1">
                {week.map(day => {
                  const dStr = getLocalDateString(day);
                  const plans = scheduled?.filter(s => s.date === dStr) || [];
                  const hists = historyData?.filter(h => h.date === dStr) || [];
                  const isOtherMonth = day.getMonth() !== primaryMonth;
                  const isFirst = day.getDate() === 1;

                  let bgClass = isOtherMonth ? 'bg-gray-100/80 border-gray-200/70 opacity-75' : 'bg-white border-gray-200';
                  let textClass = isOtherMonth ? 'text-gray-500' : 'text-gray-800';
                  let content = null;

                  if (hists.length > 0) {
                    const wObj = workouts?.find(w => w.id === hists[0].workoutId || w.name === hists[0].workoutName);
                    const label = wObj?.muscle || 'Загальна';
                    bgClass = isOtherMonth ? 'bg-green-50 border-green-200 opacity-85' : 'bg-green-100 border-green-300 shadow-sm';
                    textClass = 'text-green-800 font-bold';
                    content = (
                      <div className="flex flex-col items-center mt-1 leading-tight">
                        <span className="text-[9px] font-bold truncate max-w-[44px]">{label}</span>
                        <span className="text-[9px] font-mono opacity-85 mt-0.5">{formatDuration(hists[0].duration)}</span>
                      </div>
                    );
                  } else if (plans.length > 0) {
                    const wObj = workouts?.find(w => w.id === plans[0].workoutId);
                    const pName = plans[0].name || wObj?.name || '?';
                    bgClass = 'bg-blue-50 border-blue-300 shadow-sm';
                    textClass = 'text-blue-900 font-bold';
                    content = (
                      <div className="flex flex-col items-center mt-1 leading-tight">
                        <span className="text-sm text-blue-600 font-black leading-none">{pName.charAt(0).toUpperCase()}</span>
                        <span className="text-[8px] font-mono text-blue-400">план</span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={dStr}
                      onClick={() => setDayDetailsDate(dStr)}
                      className={`min-h-[68px] flex flex-col items-center pt-1 pb-1 rounded-lg text-xs cursor-pointer border ${bgClass}${textClass} ${dStr === todayStr ? 'ring-2 ring-blue-500' : ''} ${isFirst ? 'border-t-2 border-t-blue-500' : ''}`}
                    >
                      <span className={`text-[10px] leading-none font-bold ${isFirst ? 'text-blue-600' : ''}`}>
                        {day.getDate()}
                        {isFirst && <span className="text-[8px] uppercase ml-0.5">{day.toLocaleDateString('uk-UA', { month: 'short' }).replace('.', '')}</span>}
                      </span>
                      {content}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ВКЛАДКА ТАБЛИЦЯ (7 ДНІВ, ЛИШЕ АКТИВНІ РЯДКИ, СВАЙП ВЛІВО/ВПРАВО) */}
      {view === 'matrix' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto relative touch-pan-y" onTouchStart={onMatrixTouchStart} onTouchEnd={onMatrixTouchEnd}>
          <table className="w-full text-left border-collapse table-fixed">
            <thead>
              <tr>
                <th className="sticky left-0 bg-white z-10 p-1 border-b border-r w-[82px]">
                  <div className="flex justify-between items-center bg-gray-100 rounded p-0.5">
                    <button onClick={() => setDayOffset(d => d - 1)} className="p-1 bg-white rounded shadow-sm text-gray-600"><ChevronLeft size={14} /></button>
                    <button onClick={() => setDayOffset(d => d + 1)} className="p-1 bg-white rounded shadow-sm text-gray-600"><ChevronRight size={14} /></button>
                  </div>
                </th>
                {visibleDays.map(day => {
                  const dStr = getLocalDateString(day), isToday = dStr === todayStr;
                  return (
                    <th key={dStr} className={`py-1 px-0.5 border-b text-center ${isToday ? 'bg-blue-50' : ''}`}>
                      <div className={`text-[9px] uppercase leading-none ${isToday ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>{day.toLocaleDateString('uk-UA', { weekday: 'short' })}</div>
                      <div className={`text-[11px] font-bold leading-tight mt-0.5 ${isToday ? 'text-blue-700' : 'text-gray-800'}`}>{day.getDate()}.{(day.getMonth() + 1).toString().padStart(2, '0')}</div>
                      <button onClick={() => setPlanModalDate(dStr)} className="mt-1 w-5 h-5 mx-auto rounded-full bg-blue-50 text-blue-600 flex items-center justify-center active:bg-blue-200"><Plus size={12} /></button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {activeWorkoutsInPeriod && activeWorkoutsInPeriod.length > 0 ? activeWorkoutsInPeriod.map(w => (
                <tr key={w.id} className="hover:bg-gray-50">
                  <td className="sticky left-0 bg-white z-10 p-1.5 border-b border-r w-[82px]" style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
                    <div className="text-[8px] font-bold text-gray-400 uppercase leading-none mb-0.5">{w.muscle || 'Загальна'}</div>
                    <div className="text-[10px] font-bold text-gray-800 leading-tight">{w.name}</div>
                  </td>
                  {visibleDays.map(day => {
                    const dStr = getLocalDateString(day), isToday = dStr === todayStr;
                    const hist = historyData?.find(h => h.date === dStr && (h.workoutId === w.id || h.workoutName === w.name));
                    const plan = scheduled?.find(s => s.date === dStr && s.workoutId === w.id);
                    const letter = (plan?.name || w.name).charAt(0).toUpperCase();
                    return (
                      <td key={dStr} className={`p-0.5 border-
