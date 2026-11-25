import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom';
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
    this.version(2).stores({
      exercises: 'id, name, category, muscle',
      workouts: 'id, name, muscle',
      scheduled: 'id, date, workoutId',
      history: 'id, date, workoutId'
    });
  }
}
export const db = new WorkoutJournalDB();

const MUSCLE_GROUPS = ['Груди', 'Ноги', 'Спина', 'Плечі', 'Руки', 'Загальна'];
const generateId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
const formatDuration = (secs: number) => (!secs || secs <= 0 ? '--:--' : `${Math.floor(secs / 60)}:${Math.floor(secs % 60).toString().padStart(2, '0')}`);
const getLocalDateString = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const getMondayOfWeek = (d: Date) => { const r = new Date(d.getFullYear(), d.getMonth(), d.getDate()); r.setDate(r.getDate() - ((r.getDay() + 6) % 7)); return r; };

const initialExercises = [
  { category: 'МИНОТАВР', name: 'ГОБЛЕТ-присидання', muscle: 'Ноги' },
  { category: 'МИНОТАВР', name: 'ПРОТЯЖКА до подборіддя', muscle: 'Плечі' },
  { category: 'МИНОТАВР', name: 'МАХИ 2 руками', muscle: 'Загальна' },
  { category: 'МИНОТАВР', name: 'ТЯГА В НАКЛОНІ до поясу', muscle: 'Спина' },
  { category: 'МИНОТАВР', name: 'СТАНОВА ТЯГА з гірею', muscle: 'Спина' },
  { category: 'НОГИ', name: 'ПРИСІДАННЯ з ЕСПАНДЕРОМ', muscle: 'Ноги' },
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
  { name: 'ДРАБИНА з ГИРЕЮ', muscle: 'Загальна', exercises: ['МАХИ 2 руками', 'ГОБЛЕТ-присидання', 'ВІДЖИМАННЯ'] },
  { name: 'ТРАСТЕР', muscle: 'Загальна', exercises: ['ТРАСТЕР з еспандером'] },
  { name: 'БРУСИ (драбина)', muscle: 'Груди', exercises: ['ВІДЖИМАННЯ на брусах'] },
  { name: 'БРУСИ (важко)', muscle: 'Груди', exercises: ['ВІДЖИМАННЯ на брусах'] },
  { name: 'ДЕЛЬТИ', muscle: 'Плечі', exercises: ['ПРОТЯЖКА до подборіддя еспандер', 'ЖИМ ЕСПАНДЕРА над головою', 'РОЗВЕДЕННЯ ЕСПАНДЕРА В СТОРОНИ', 'ПІДНЯТТЯ ЕСПАНДЕРА з ротацією', 'РОЗВЕДЕННЯ ЕСПАНДЕРА однією рукою', 'РОЗВЕДЕННЯ ЕСПАНДЕРА перед собою', 'ТЯГА В НАКЛОНІ на задню дельту'] },
  { name: 'СПИНА', muscle: 'Спина', exercises: ['ПІДТЯГУВАННЯ', 'ПІДТЯГУВАННЯ З ЕСПАНДЕРОМ', 'ТЯГА В НАКЛОНІ еспандера зворотнім хватом', 'ШРАГИ З ЕСПАНДЕРОМ', 'ПРОТЯЖКА до подборіддя', 'СТАНОВА ТЯГА з еспандером'] }
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
              <Plus size={18} /> {search.trim() ? `Створити «${search.trim()}»` : 'Створити нову вправу'}
            </button>
            <div className="space-y-2 overflow-y-auto flex-1 pb-4">
              {filtered.map(ex => (
                <button key={ex.id} onClick={() => onSelect(ex)} className="w-full text-left p-3 bg-gray-50 border rounded-lg font-medium active:bg-gray-200 flex justify-between items-center">
                  <span className="pr-2">{ex.name}</span>
                  <span className="text-[10px] text-gray-400 uppercase font-bold shrink-0">{ex.muscle || 'Загальна'}</span>
                </button>
              ))}
              {filtered.length === 0 && <div className="text-center text-gray-400 text-sm mt-4">Нічого не знайдено</div>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 3. КОНТЕКСТ ТАЙМЕРІВ (ФОНОВА РОБОТА)
// ==========================================
const TimerContext = createContext<any>(null);
export const useTimer = () => useContext(TimerContext);

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [savedWorkoutData, setSavedWorkoutData] = useState<{ plan: Scheduled; workout: Workout } | null>(null);
  const [finishItems, setFinishItems] = useState<WorkoutItem[]>([]);
  const [mode, setMode] = useState<'TABATA' | 'FREE'>(localStorage.getItem('active_workout_backup') ? 'FREE' : 'TABATA');

  useEffect(() => {
    if (location.pathname === '/timer' && location.state) {
      const data = location.state as any;
      setSavedWorkoutData(data);
      setMode('FREE');
      localStorage.setItem('active_workout_backup', JSON.stringify(data));
      setFinishItems((data.plan?.items || data.workout?.items || []).map((i: any) => ({ ...i })));
      navigate('/timer', { replace: true, state: null });
    } else if (!savedWorkoutData) {
      const backup = localStorage.getItem('active_workout_backup');
      if (backup) {
        try {
          const parsed = JSON.parse(backup);
          setSavedWorkoutData(parsed);
          setFinishItems((parsed.plan?.items || parsed.workout?.items || []).map((i: any) => ({ ...i })));
        } catch {}
      }
    }
  }, [location.pathname, location.state, navigate]);

  const audioCtx = useRef<AudioContext | null>(null);
  const wakeLockRef = useRef<any>(null);
  const silentOscRef = useRef<any>(null);

  const [workTime, setWorkTime] = useState<number | ''>(() => Number(localStorage.getItem('tabata_work')) || 20);
  const [restTime, setRestTime] = useState<number | ''>(() => Number(localStorage.getItem('tabata_rest')) || 10);
  const [rounds, setRounds] = useState<number | ''>(() => Number(localStorage.getItem('tabata_rounds')) || 8);
  const [isRunning, setIsRunning] = useState(false);
  const [phase, setPhase] = useState<'PREP' | 'WORK' | 'REST' | 'IDLE'>('IDLE');
  const [timeLeft, setTimeLeft] = useState(Number(workTime) || 20);
  const [currentRound, setCurrentRound] = useState(1);
  const tabataEndTime = useRef(0);
  const lastTabataBeep = useRef(0);

  const [freeTime, setFreeTime] = useState(0);
  const [freePhase, setFreePhase] = useState<'Розминка' | 'Основна' | 'Заминка' | 'Зупинено'>('Зупинено');
  const [workoutNote, setWorkoutNote] = useState('');
  const [phaseTimes, setPhaseTimes] = useState({ warmup: 0, main: 0, cooldown: 0 });
  const lastFreeTick = useRef(Date.now());

  const [freeRestTime, setFreeRestTime] = useState<number | ''>(() => Number(localStorage.getItem('free_rest_time')) || 60);
  const [freeRestTimeLeft, setFreeRestTimeLeft] = useState(Number(freeRestTime) || 60);
  const [isFreeResting, setIsFreeResting] = useState(false);
  const freeRestEndTime = useRef(0);
  const lastFreeRestBeep = useRef(0);

  const [showTimeEdit, setShowTimeEdit] = useState(false);
  const [editTimes, setEditTimes] = useState({ wm: 0, ws: 0, mm: 0, ms: 0, cm: 0, cs: 0 });
  const [showFinishAddEx, setShowFinishAddEx] = useState(false);
  const activeName = savedWorkoutData?.plan?.name || savedWorkoutData?.workout?.name || '';

  useEffect(() => {
    if (typeof workTime === 'number') localStorage.setItem('tabata_work', String(workTime));
    if (typeof restTime === 'number') localStorage.setItem('tabata_rest', String(restTime));
    if (typeof rounds === 'number') localStorage.setItem('tabata_rounds', String(rounds));
    if (typeof freeRestTime === 'number') localStorage.setItem('free_rest_time', String(freeRestTime));
  }, [workTime, restTime, rounds, freeRestTime]);

  const beep = (freq: number, dur: number) => {
    if (!audioCtx.current) return;
    const osc = audioCtx.current.createOscillator();
    osc.connect(audioCtx.current.destination);
    osc.frequency.value = freq;
    osc.start();
    osc.stop(audioCtx.current.currentTime + dur);
  };
  const startSilent = () => {
    if (!audioCtx.current || silentOscRef.current) return;
    const osc = audioCtx.current.createOscillator();
    const gain = audioCtx.current.createGain();
    gain.gain.value = 0.001;
    osc.connect(gain); gain.connect(audioCtx.current.destination); osc.start();
    silentOscRef.current = osc;
  };
  const stopSilent = () => { if (silentOscRef.current) { silentOscRef.current.stop(); silentOscRef.current.disconnect(); silentOscRef.current = null; } };
  const initAudio = () => { if (!audioCtx.current) audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)(); audioCtx.current.resume(); };
  const reqWL = async () => { try { if ('wakeLock' in navigator) wakeLockRef.current = await (navigator as any).wakeLock.request('screen'); } catch {} };
  const relWL = () => { if (wakeLockRef.current) { wakeLockRef.current.release().catch(() => {}); wakeLockRef.current = null; } };

  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible' && (isRunning || freePhase !== 'Зупинено')) reqWL(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [isRunning, freePhase]);

  useEffect(() => { if (phase === 'IDLE') setTimeLeft(Number(workTime) || 20); }, [workTime, phase]);

  useEffect(() => {
    let t: number;
    const sw = Number(workTime) || 20, sr = Number(restTime) || 10, rnd = Number(rounds) || 8;
    if (isRunning) {
      t = window.setInterval(() => {
        const rem = Math.ceil((tabataEndTime.current - Date.now()) / 1000);
        if (rem <= 3 && rem > 0 && lastTabataBeep.current !== rem) { beep(800, 0.1); lastTabataBeep.current = rem; }
        if (rem <= 0) {
          lastTabataBeep.current = 0;
          if (phase === 'PREP') { setPhase('WORK'); beep(1200, 0.5); tabataEndTime.current = Date.now() + sw * 1000; }
          else if (phase === 'WORK') {
            if (currentRound >= rnd) { setIsRunning(false); setPhase('IDLE'); beep(400, 1); relWL(); stopSilent(); }
            else { setPhase('REST'); beep(1200, 0.5); tabataEndTime.current = Date.now() + sr * 1000; }
          } else if (phase === 'REST') { setPhase('WORK'); setCurrentRound(r => r + 1); beep(1200, 0.5); tabataEndTime.current = Date.now() + sw * 1000; }
        } else setTimeLeft(rem);
      }, 100);
    }
    return () => clearInterval(t);
  }, [isRunning, phase, currentRound, rounds, workTime, restTime]);

  const toggleTabata = () => {
    initAudio();
    if (!isRunning && phase === 'IDLE') { reqWL(); startSilent(); setPhase('PREP'); setCurrentRound(1); tabataEndTime.current = Date.now() + 5000; }
    else if (!isRunning) { reqWL(); startSilent(); tabataEndTime.current = Date.now() + timeLeft * 1000; }
    else { relWL(); stopSilent(); }
    setIsRunning(!isRunning);
  };
  const resetTabata = () => { setPhase('IDLE'); setIsRunning(false); relWL(); stopSilent(); };

  useEffect(() => {
    let t: number;
    if (freePhase !== 'Зупинено') {
      lastFreeTick.current = Date.now();
      t = window.setInterval(() => {
        const now = Date.now(), d = (now - lastFreeTick.current) / 1000;
        lastFreeTick.current = now;
        setFreeTime(p => p + d);
        setPhaseTimes(p => freePhase === 'Розминка' ? { ...p, warmup: p.warmup + d } : freePhase === 'Основна' ? { ...p, main: p.main + d } : { ...p, cooldown: p.cooldown + d });
      }, 1000);
    }
    return () => clearInterval(t);
  }, [freePhase]);

  useEffect(() => {
    let t: number;
    if (isFreeResting) {
      t = window.setInterval(() => {
        const rem = Math.ceil((freeRestEndTime.current - Date.now()) / 1000);
        if (rem <= 5 && rem > 0 && lastFreeRestBeep.current !== rem) { beep(800, 0.1); lastFreeRestBeep.current = rem; }
        if (rem <= 0) { beep(1200, 0.5); setIsFreeResting(false); lastFreeRestBeep.current = 0; }
        else setFreeRestTimeLeft(rem);
      }, 100);
    }
    return () => clearInterval(t);
  }, [isFreeResting]);

  const toggleFreeRest = () => {
    initAudio();
    if (!isFreeResting) { const s = Number(freeRestTime) || 60; setFreeRestTimeLeft(s); freeRestEndTime.current = Date.now() + s * 1000; setIsFreeResting(true); }
    else setIsFreeResting(false);
  };

  const startFreePhase = (np: 'Розминка' | 'Основна' | 'Заминка') => { initAudio(); reqWL(); startSilent(); setFreePhase(np); };
  const initiateStopFreeWorkout = () => {
    initAudio(); relWL(); stopSilent(); setIsFreeResting(false); setFreePhase('Зупинено');
    if (savedWorkoutData) {
      setEditTimes({
        wm: Math.floor(phaseTimes.warmup / 60), ws: Math.floor(phaseTimes.warmup % 60),
        mm: Math.floor(phaseTimes.main / 60), ms: Math.floor(phaseTimes.main % 60),
        cm: Math.floor(phaseTimes.cooldown / 60), cs: Math.floor(phaseTimes.cooldown % 60)
      });
      setShowTimeEdit(true);
    } else { setFreeTime(0); setPhaseTimes({ warmup: 0, main: 0, cooldown: 0 }); }
  };

  const clearActiveWorkout = () => {
    if (!window.confirm('Скасувати поточне тренування?')) return;
    localStorage.removeItem('active_workout_backup');
    setSavedWorkoutData(null); setFreeTime(0); setPhaseTimes({ warmup: 0, main: 0, cooldown: 0 }); setFreePhase('Зупинено'); navigate('/');
  };

  const updateFinishItem = (idx: number, field: keyof WorkoutItem, val: string) => {
    const n = finishItems.map(i => ({ ...i })); n[idx] = { ...n[idx], [field]: val }; setFinishItems(n);
  };

  const saveFinalFreeWorkout = async () => {
    const fw = editTimes.wm * 60 + editTimes.ws, fm = editTimes.mm * 60 + editTimes.ms, fc = editTimes.cm * 60 + editTimes.cs;
    const breakdown = `[Розминка: ${formatDuration(fw)} | Основна: ${formatDuration(fm)} | Заминка: ${formatDuration(fc)}]`;
    const allExs = await db.exercises.toArray();
    const snapItems = finishItems.map(it => { const ex = allExs.find(e => e.id === it.exerciseId); return { ...it, exNameSnapshot: ex?.name, exMuscleSnapshot: ex?.muscle }; });
    const finalNote = workoutNote.trim() ? [workoutNote.trim(), breakdown].join(String.fromCharCode(10, 10)) : breakdown;
    await db.history.add({
      id: generateId(), date: savedWorkoutData?.plan?.date || getLocalDateString(new Date()),
      workoutId: savedWorkoutData?.plan?.workoutId || savedWorkoutData?.workout?.id, workoutName: activeName,
      duration: fw + fm + fc, items: snapItems, note: finalNote
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
// 4. КАЛЕНДАР (ТАБЛИЦЯ 7 ДНІВ + КАРТКА ДНЯ + МІСЯЦЬ)
// ==========================================
function CalendarView() {
  const navigate = useNavigate();
  const todayStr = getLocalDateString(new Date());
  const [view, setView] = useState<'matrix' | 'month'>('matrix');
  const [dayOffset, setDayOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
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

  const visibleDays = Array.from({ length: 7 }).map((_, i) => { const d = new Date(); d.setDate(d.getDate() + dayOffset + i - 5); return d; });
  const visibleDateStrings = visibleDays.map(getLocalDateString);

  const sixWeeks: Date[][] = Array.from({ length: 6 }).map((_, w) =>
    Array.from({ length: 7 }).map((__, d) => { const dt = new Date(monthStartMonday); dt.setDate(monthStartMonday.getDate() + w * 7 + d); return dt; })
  );
  const midDate = sixWeeks[2][3];
  const primaryMonth = midDate.getMonth();
  const primaryYear = midDate.getFullYear();

  const shiftMonthWeeks = (weeksDelta: number) => setMonthStartMonday(prev => { const n = new Date(prev); n.setDate(n.getDate() + weeksDelta * 7); return n; });

  const onMatrixTouchStart = (e: React.TouchEvent) => { touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onMatrixTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x, dy = e.changedTouches[0].clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      const shift = Math.min(7, Math.max(1, Math.round(Math.abs(dx) / 55)));
      setDayOffset(p => p + (dx < 0 ? shift : -shift));
    }
  };

  const onMonthTouchStart = (e: React.TouchEvent) => { touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onMonthTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x, dy = e.changedTouches[0].clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dy) > 40 && Math.abs(dy) > Math.abs(dx) * 1.2) {
      const weeksShift = Math.min(4, Math.max(1, Math.round(Math.abs(dy) / 70)));
      shiftMonthWeeks(dy < 0 ? weeksShift : -weeksShift);
    }
  };

  const initiatePlanSetup = (date: string, w: Workout) => {
    setSelectedDate(date);
    setPlanSetup({ date, baseWorkoutId: w.id, editName: w.name, editItems: (w.items || []).map(i => ({ ...i })), showAddEx: false });
  };
  const savePlanSetup = async () => {
    if (!planSetup) return;
    await db.scheduled.add({ id: generateId(), date: planSetup.date, workoutId: planSetup.baseWorkoutId, name: planSetup.editName, items: planSetup.editItems, isCompleted: false });
    setPlanSetup(null);
  };
  const handleMarkDone = async (plan: Scheduled) => {
    const w = workouts?.find(x => x.id === plan.workoutId);
    const items = (plan.items || w?.items || []).map(it => { const ex = exercises?.find(e => e.id === it.exerciseId); return { ...it, exNameSnapshot: ex?.name, exMuscleSnapshot: ex?.muscle }; });
    await db.history.add({ id: generateId(), date: plan.date, workoutId: plan.workoutId, workoutName: plan.name || w?.name || 'Невідомо', duration: 0, items, note: planNote });
    await db.scheduled.delete(plan.id);
    setActivePlanAction(null);
  };
  const handleStart = (plan: Scheduled, workout?: Workout) => {
    const fallback: Workout = workout || { id: plan.workoutId, name: plan.name || 'Тренування', items: plan.items || [], note: '' };
    setActivePlanAction(null);
    navigate('/timer', { state: { plan, workout: fallback } });
  };
  const handleCellClickMatrix = (dStr: string, w: Workout, isPlanned: boolean, planObj?: Scheduled) => {
    setSelectedDate(dStr);
    if (isPlanned && planObj) setActivePlanAction(planObj); else initiatePlanSetup(dStr, w);
  };

  const sortedWorkouts = workouts?.slice().sort((a, b) => a.name.localeCompare(b.name, 'uk-UA'));
  const activeWorkoutsInPeriod = sortedWorkouts?.filter(w =>
    historyData?.some(h => visibleDateStrings.includes(h.date) && (h.workoutId === w.id || h.workoutName === w.name)) ||
    scheduled?.some(s => visibleDateStrings.includes(s.date) && s.workoutId === w.id)
  );

  const selectedPlans = scheduled?.filter(s => s.date === selectedDate) || [];
  const selectedHists = historyData?.filter(h => h.date === selectedDate) || [];
  const selectedDateFormatted = (() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const wd = new Date(y, m - 1, d).toLocaleDateString('uk-UA', { weekday: 'short' });
    return `${selectedDate === todayStr ? 'Сьогодні • ' : ''}${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')} (${wd})`;
  })();

  return (
    <div className="p-1.5 pb-24">
      <div className="flex justify-between items-center mb-3 px-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded">v3.4</span>
          <div className="flex bg-gray-200 rounded-lg p-0.5">
            <button className={`px-3 py-1 rounded-md text-xs font-bold ${view === 'matrix' ? 'bg-white shadow' : ''}`} onClick={() => setView('matrix')}>Таблиця</button>
            <button className={`px-3 py-1 rounded-md text-xs font-bold ${view === 'month' ? 'bg-white shadow' : ''}`} onClick={() => setView('month')}>Місяць</button>
          </div>
        </div>
        <button
          onClick={() => { const n = new Date(); setDayOffset(0); setSelectedDate(getLocalDateString(n)); setMonthStartMonday(getMondayOfWeek(new Date(n.getFullYear(), n.getMonth(), 1))); }}
          className="text-blue-600 font-bold text-xs bg-blue-50 px-3 py-1.5 rounded-lg"
        >Сьогодні</button>
      </div>

      {/* ВКЛАДКА МІСЯЦЬ (РІВНО 6 ТИЖНІВ) */}
      {view === 'month' && (
        <div className="bg-white rounded-xl shadow-sm p-2.5 mx-0.5 touch-none" onTouchStart={onMonthTouchStart} onTouchEnd={onMonthTouchEnd}>
          <div className="flex items-center gap-1.5 mb-2.5">
            <select value={primaryMonth} onChange={e => setMonthStartMonday(getMondayOfWeek(new Date(primaryYear, Number(e.target.value), 1)))} className="p-2 border rounded-lg font-bold bg-gray-50 flex-1 text-sm capitalize">
              {Array.from({ length: 12 }).map((_, i) => <option key={i} value={i}>{new Date(2000, i).toLocaleDateString('uk-UA', { month: 'long' })}</option>)}
            </select>
            <select value={primaryYear} onChange={e => setMonthStartMonday(getMondayOfWeek(new Date(Number(e.target.value), primaryMonth, 1)))} className="p-2 border rounded-lg font-bold bg-gray-50 w-20 text-sm">
              {[2024, 2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <div className="flex flex-col gap-0.5">
              <button onClick={() => shiftMonthWeeks(-1)} className="px-2 py-0.5 bg-gray-100 rounded text-gray-600"><ChevronUp size={14} /></button>
              <button onClick={() => shiftMonthWeeks(1)} className="px-2 py-0.5 bg-gray-100 rounded text-gray-600"><ChevronDown size={14} /></button>
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
                    bgClass = isOtherMonth ? 'bg-green-50 border-green-200 opacity-85' : 'bg-green-100 border-green-300 shadow-sm';
                    textClass = 'text-green-800 font-bold';
                    content = (
                      <div className="flex flex-col items-center mt-1 leading-tight">
                        <span className="text-[9px] font-bold truncate max-w-[44px]">{wObj?.muscle || 'Загальна'}</span>
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
                    <div key={dStr} onClick={() => setDayDetailsDate(dStr)} className={`min-h-[68px] flex flex-col items-center pt-1 pb-1 rounded-lg text-xs cursor-pointer border ${bgClass} ${textClass} ${dStr === todayStr ? 'ring-2 ring-blue-500' : ''} ${isFirst ? 'border-t-2 border-t-blue-500' : ''}`}>
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

      {/* ВКЛАДКА ТАБЛИЦЯ (ВИЩІ РЯДКИ h-16 + КАРТКА ОБРАНОГО ДНЯ) */}
      {view === 'matrix' && (
        <div className="space-y-3">
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
                    const dStr = getLocalDateString(day), isToday = dStr === todayStr, isSelected = dStr === selectedDate;
                    return (
                      <th key={dStr} onClick={() => setSelectedDate(dStr)} className={`py-1.5 px-0.5 border-b text-center cursor-pointer ${isSelected ? 'bg-blue-100/80 border-b-2 border-b-blue-600' : isToday ? 'bg-blue-50/60' : ''}`}>
                        <div className={`text-[9px] uppercase leading-none ${isSelected || isToday ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>{day.toLocaleDateString('uk-UA', { weekday: 'short' })}</div>
                        <div className={`text-[11px] font-bold leading-tight mt-0.5 ${isSelected || isToday ? 'text-blue-800' : 'text-gray-800'}`}>{day.getDate()}.{(day.getMonth() + 1).toString().padStart(2, '0')}</div>
                        <button onClick={e => { e.stopPropagation(); setSelectedDate(dStr); setPlanModalDate(dStr); }} className="mt-1 w-5 h-5 mx-auto rounded-full bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200/60"><Plus size={12} /></button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {activeWorkoutsInPeriod && activeWorkoutsInPeriod.length > 0 ? activeWorkoutsInPeriod.map(w => (
                  <tr key={w.id} className="hover:bg-gray-50">
                    <td className="sticky left-0 bg-white z-10 px-1.5 py-2 border-b border-r w-[82px]" style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
                      <div className="text-[8px] font-bold text-gray-400 uppercase leading-none mb-1">{w.muscle || 'Загальна'}</div>
                      <div className="text-[11px] font-bold text-gray-800 leading-tight">{w.name}</div>
                    </td>
                    {visibleDays.map(day => {
                      const dStr = getLocalDateString(day), isSelected = dStr === selectedDate;
                      const hist = historyData?.find(h => h.date === dStr && (h.workoutId === w.id || h.workoutName === w.name));
                      const plan = scheduled?.find(s => s.date === dStr && s.workoutId === w.id);
                      const letter = (plan?.name || w.name).charAt(0).toUpperCase();
                      return (
                        <td key={dStr} className={`p-0.5 border-b text-center align-middle border-l border-gray-100 ${isSelected && !hist ? 'bg-blue-50/40' : ''}`}>
                          {hist ? (
                            <div onClick={() => { setSelectedDate(dStr); setActiveHistoryAction(hist); }} className="bg-green-100 text-green-800 rounded-md flex flex-col items-center justify-center cursor-pointer w-full h-16 border border-green-200">
                              <span className="text-base font-black leading-none">{letter}</span>
                              <span className="text-[10px] mt-1 font-mono leading-none font-bold">{formatDuration(hist.duration)}</span>
                            </div>
                          ) : plan ? (
                            <button onClick={() => handleCellClickMatrix(dStr, w, true, plan)} className="bg-blue-500 text-white rounded-md w-full h-16 shadow-sm flex flex-col items-center justify-center">
                              <span className="text-base font-black leading-none">{letter}</span>
                              <span className="text-[10px] mt-1 font-mono text-blue-100 leading-none">план</span>
                            </button>
                          ) : (
                            <div onClick={() => handleCellClickMatrix(dStr, w, false)} className="h-16 w-full rounded flex items-center justify-center text-gray-300 cursor-pointer"><Plus size={14} /></div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                )) : (
                  <tr><td colSpan={8} className="p-6 text-center text-xs text-gray-400">У цьому періоді немає тренувань. Натисніть <b>+</b> під датою або свайпніть вліво/вправо.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* КАРТКА ОБРАНОГО ДНЯ */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3.5">
            <div className="flex justify-between items-center mb-2.5 pb-2 border-b border-gray-100">
              <span className="text-xs font-bold uppercase text-gray-500">{selectedDateFormatted}</span>
              <button onClick={() => setPlanModalDate(selectedDate)} className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg flex items-center gap-1"><Plus size={14} /> План</button>
            </div>

            {selectedPlans.length === 0 && selectedHists.length === 0 && (
              <div className="py-3 text-center">
                <div className="text-xs text-gray-400 mb-2">На цей день тренувань не заплановано</div>
                <button onClick={() => setPlanModalDate(selectedDate)} className="w-full py-2.5 bg-blue-50 text-blue-600 rounded-xl font-bold text-xs border border-dashed border-blue-300">+ Запланувати тренування</button>
              </div>
            )}

            <div className="space-y-3">
              {selectedPlans.map(plan => {
                const wObj = workouts?.find(w => w.id === plan.workoutId);
                const pItems = plan.items || wObj?.items || [];
                return (
                  <div key={plan.id} className="bg-blue-50/60 border border-blue-200 rounded-xl p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-blue-500">{wObj?.muscle || 'Загальна'} • ПЛАН</span>
                        <h4 className="font-bold text-base text-gray-900">{plan.name || wObj?.name || 'Тренування'}</h4>
                      </div>
                      <button onClick={() => setActivePlanAction(plan)} className="text-gray-400 bg-white p-1.5 rounded-lg border"><Edit2 size={15} /></button>
                    </div>
                    {pItems.length > 0 && (
                      <div className="bg-white rounded-lg p-2.5 border border-blue-100 space-y-1.5 mb-3">
                        {pItems.map((it, idx) => (
                          <div key={idx} className="flex justify-between text-xs border-b border-gray-50 pb-1 last:border-0 last:pb-0">
                            <span className="font-medium text-gray-800 pr-2">{it.exNameSnapshot || exercises?.find(e => e.id === it.exerciseId)?.name || 'Вправа'}</span>
                            <span className="font-mono text-gray-500 shrink-0">{[it.weight, it.band, it.reps].filter(Boolean).join(' | ') || '-'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <button onClick={() => handleStart(plan, wObj)} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm">
                      <Play size={18} /> Почати тренування
                    </button>
                  </div>
                );
              })}

              {selectedHists.map(hist => {
                const wObj = workouts?.find(w => w.id === hist.workoutId || w.name === hist.workoutName);
                return (
                  <div key={hist.id} className="bg-green-50/70 border border-green-200 rounded-xl p-3">
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-green-600">{wObj?.muscle || 'Загальна'} • ВИКОНАНО</span>
                        <h4 className="font-bold text-base text-green-900">✓ {hist.workoutName}</h4>
                      </div>
                      <span className="text-sm font-mono font-bold bg-green-100 text-green-800 px-2.5 py-1 rounded-lg border border-green-200">{formatDuration(hist.duration)}</span>
                    </div>
                    {hist.items && hist.items.length > 0 && (
                      <div className="bg-white rounded-lg p-2.5 border border-green-100 space-y-1.5">
                        {hist.items.map((it, idx) => (
                          <div key={idx} className="flex justify-between text-xs border-b border-gray-50 pb-1 last:border-0 last:pb-0">
                            <span className="font-medium text-gray-800 pr-2">{it.exNameSnapshot || exercises?.find(e => e.id === it.exerciseId)?.name || 'Вправа'}</span>
                            <span className="font-mono text-gray-500 shrink-0">{[it.weight, it.band, it.reps].filter(Boolean).join(' | ') || '-'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {hist.note && <div className="mt-2 text-xs text-gray-600 bg-white/80 p-2 rounded-lg border border-green-100 whitespace-pre-wrap">{hist.note}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Модалка: Корекція при плануванні */}
      {planSetup && (
        <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-[110] p-2 pb-16">
          <div className="bg-white w-full max-w-md rounded-2xl p-4 shadow-2xl max-h-[88vh] flex flex-col">
            <div className="flex justify-between items-center mb-3 border-b pb-2"><h3 className="font-bold text-lg">План на {planSetup.date}</h3><button onClick={() => setPlanSetup(null)} className="text-gray-400 bg-gray-100 rounded-full p-1"><X size={20} /></button></div>
            <input value={planSetup.editName} onChange={e => setPlanSetup({ ...planSetup, editName: e.target.value })} placeholder="Назва плану" className="w-full p-2.5 border rounded-lg mb-3 font-bold bg-gray-50" />
            <div className="flex-1 overflow-y-auto space-y-2.5 mb-3">
              {planSetup.editItems.map((item, idx) => (
                <div key={idx} className="p-3 bg-white border rounded-xl shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-sm text-blue-800">{exercises?.find(e => e.id === item.exerciseId)?.name || 'Вправа'}</span>
                    <button onClick={() => { const n = [...planSetup.editItems]; n.splice(idx, 1); setPlanSetup({ ...planSetup, editItems: n }); }} className="text-red-400"><Trash2 size={16} /></button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input type="text" placeholder="Вага" value={item.weight} onChange={e => { const n = [...planSetup.editItems]; n[idx] = { ...n[idx], weight: e.target.value }; setPlanSetup({ ...planSetup, editItems: n }); }} className="p-2 border rounded text-xs bg-gray-50" />
                    <input type="text" placeholder="Еспандер" value={item.band} onChange={e => { const n = [...planSetup.editItems]; n[idx] = { ...n[idx], band: e.target.value }; setPlanSetup({ ...planSetup, editItems: n }); }} className="p-2 border rounded text-xs bg-gray-50" />
                    <input type="text" inputMode="text" placeholder="5x8" value={item.reps} onChange={e => { const n = [...planSetup.editItems]; n[idx] = { ...n[idx], reps: e.target.value }; setPlanSetup({ ...planSetup, editItems: n }); }} className="p-2 border rounded text-xs bg-gray-50" />
                  </div>
                </div>
              ))}
              <button onClick={() => setPlanSetup({ ...planSetup, showAddEx: true })} className="w-full py-3 bg-blue-50 text-blue-600 rounded-lg font-bold border border-dashed border-blue-300 flex justify-center items-center gap-2"><Plus size={18} /> Додати вправу</button>
            </div>
            <div className="flex gap-3 shrink-0">
              <button onClick={() => setPlanSetup(null)} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-bold">Скасувати</button>
              <button onClick={savePlanSetup} className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold flex justify-center items-center gap-2"><Save size={18} /> Зберегти</button>
            </div>
          </div>
          {planSetup.showAddEx && <ExercisePickerModal exercises={exercises} onClose={() => setPlanSetup({ ...planSetup, showAddEx: false })} onSelect={ex => setPlanSetup({ ...planSetup, editItems: [...planSetup.editItems, { exerciseId: ex.id, weight: '', band: '', reps: '', note: '' }], showAddEx: false })} />}
        </div>
      )}

      {/* Деталі дня (Місяць) */}
      {dayDetailsDate && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-[100] pb-20">
          <div className="bg-white w-full rounded-t-2xl p-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 border-b pb-2"><h3 className="font-bold text-lg">Деталі за {dayDetailsDate}</h3><button onClick={() => setDayDetailsDate(null)} className="text-gray-400 bg-gray-100 rounded-full p-1"><X size={20} /></button></div>
            {historyData?.filter(h => h.date === dayDetailsDate).map(h => (
              <div key={h.id} className="mb-3 p-3.5 bg-green-50 border border-green-200 rounded-xl">
                <div className="flex justify-between items-center mb-1"><span className="font-bold text-green-800">✓ {h.workoutName}</span><span className="text-xs font-mono bg-green-100 text-green-800 px-2 py-1 rounded">{formatDuration(h.duration)}</span></div>
                {h.note && <div className="text-xs text-gray-700 bg-white p-2 rounded border whitespace-pre-wrap mb-2">{h.note}</div>}
                <button onClick={() => { if (window.confirm('Видалити запис з історії?')) db.history.delete(h.id); }} className="w-full bg-red-100 text-red-600 p-2 rounded-lg font-bold text-xs flex justify-center items-center gap-1"><Trash2 size={14} /> Видалити запис</button>
              </div>
            ))}
            {scheduled?.filter(s => s.date === dayDetailsDate).map(p => {
              const w = workouts?.find(x => x.id === p.workoutId);
              return (
                <div key={p.id} className="mb-3 p-3.5 bg-gray-50 border rounded-xl">
                  <div className="font-bold text-gray-800 mb-2">ПЛАН: {p.name || w?.name || 'Видалене'}</div>
                  <div className="flex gap-2">
                    <button onClick={() => { setDayDetailsDate(null); handleStart(p, w); }} className="flex-1 bg-blue-500 text-white p-2.5 rounded-lg font-bold text-xs flex justify-center items-center gap-1"><Play size={15} /> СТАРТ</button>
                    <button onClick={() => { setDayDetailsDate(null); setActivePlanAction(p); }} className="flex-1 bg-gray-200 text-gray-800 p-2.5 rounded-lg font-bold text-xs flex justify-center items-center gap-1"><CheckCircle2 size={15} /> ВІДМІТИТИ</button>
                    <button onClick={() => { if (window.confirm('Видалити план?')) db.scheduled.delete(p.id); }} className="bg-red-50 text-red-500 p-2.5 rounded-lg"><Trash2 size={15} /></button>
                  </div>
                </div>
              );
            })}
            <button onClick={() => { setPlanModalDate(dayDetailsDate); setDayDetailsDate(null); }} className="w-full mt-2 p-3 bg-blue-50 text-blue-600 rounded-lg font-bold border border-dashed border-blue-300">+ Додати план на цей день</button>
          </div>
        </div>
      )}

      {/* Дії з планом */}
      {activePlanAction && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-[100] pb-20">
          <div className="bg-white w-full rounded-t-2xl p-4">
            <div className="flex justify-between items-center mb-4 border-b pb-2"><h3 className="font-bold text-lg">Дія з планом</h3><button onClick={() => setActivePlanAction(null)} className="text-gray-400 bg-gray-100 rounded-full p-1"><X size={20} /></button></div>
            <div className="space-y-3">
              <button onClick={() => { const w = workouts?.find(x => x.id === activePlanAction.workoutId); handleStart(activePlanAction, w); }} className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold flex items-center justify-center gap-2"><Play size={20} /> Почати (Фактичний час)</button>
              <div className="bg-gray-50 p-3 rounded-xl border">
                <textarea value={planNote} onChange={e => setPlanNote(e.target.value)} placeholder="Примітка..." className="w-full p-2.5 border rounded-lg mb-2 bg-white text-sm min-h-[60px]" />
                <button onClick={() => handleMarkDone(activePlanAction)} className="w-full bg-gray-200 text-gray-800 p-3 rounded-lg font-bold flex items-center justify-center gap-2"><CheckCircle2 size={18} /> Відмітити ВИКОНАНО</button>
              </div>
              <button onClick={async () => { if (window.confirm('Видалити план?')) { await db.scheduled.delete(activePlanAction.id); setActivePlanAction(null); } }} className="w-full bg-red-50 text-red-600 p-3 rounded-xl font-bold flex items-center justify-center gap-2"><Trash2 size={18} /> Видалити план</button>
            </div>
          </div>
        </div>
      )}

      {/* Історія */}
      {activeHistoryAction && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-[100] pb-20">
          <div className="bg-white w-full rounded-t-2xl p-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-3 border-b pb-2"><h3 className="font-bold text-lg text-green-800 flex items-center gap-2"><CheckCircle2 /> {activeHistoryAction.workoutName}</h3><button onClick={() => setActiveHistoryAction(null)} className="text-gray-400 bg-gray-100 rounded-full p-1"><X size={20} /></button></div>
            <div className="text-2xl font-mono text-gray-800 mb-3">{formatDuration(activeHistoryAction.duration)}</div>
            {activeHistoryAction.items && activeHistoryAction.items.length > 0 && (
              <div className="mb-3 bg-gray-50 p-3 rounded-xl border space-y-1">
                {activeHistoryAction.items.map((it, idx) => (
                  <div key={idx} className="text-xs flex justify-between border-b border-gray-200/60 pb-1 last:border-0">
                    <span className="font-medium pr-2">{it.exNameSnapshot || exercises?.find(e => e.id === it.exerciseId)?.name || 'Вправа'}</span>
                    <span className="font-mono text-gray-600 shrink-0">{[it.weight, it.band, it.reps].filter(Boolean).join(' | ') || '-'}</span>
                  </div>
                ))}
              </div>
            )}
            {activeHistoryAction.note && <div className="mb-4 bg-gray-50 p-3 rounded-xl border text-sm whitespace-pre-wrap">{activeHistoryAction.note}</div>}
            <button onClick={() => { if (window.confirm('Видалити запис з історії?')) { db.history.delete(activeHistoryAction.id); setActiveHistoryAction(null); } }} className="w-full bg-red-100 text-red-600 p-3 rounded-xl font-bold flex items-center justify-center gap-2"><Trash2 size={18} /> Видалити з історії</button>
          </div>
        </div>
      )}

      {/* Вибір шаблону для дня */}
      {planModalDate && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-[100] pb-20">
          <div className="bg-white w-full rounded-t-2xl p-4 max-h-[70vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-3"><h3 className="font-bold text-lg">План на {planModalDate}</h3><button onClick={() => setPlanModalDate(null)} className="text-red-500 bg-red-50 rounded-full p-1"><X size={20} /></button></div>
            <div className="space-y-2">
              {sortedWorkouts?.map(w => (
                <button key={w.id} onClick={() => { const d = planModalDate; setPlanModalDate(null); initiatePlanSetup(d, w); }} className="w-full text-left p-3.5 bg-gray-50 rounded-xl font-bold border flex justify-between items-center">
                  <span>{w.name}</span><span className="text-[10px] text-gray-400 uppercase">{w.muscle || 'Загальна'}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
