import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
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
export interface WorkoutItem {
  exerciseId: string; weight: string; band: string; reps: string; note: string;
  exNameSnapshot?: string; exMuscleSnapshot?: string;
}
export interface Workout { id: string; name: string; muscle?: string; items: WorkoutItem[]; note: string; }
export interface Scheduled {
  id: string; date: string; workoutId: string; name?: string;
  items?: WorkoutItem[]; isCompleted: boolean;
}
export interface History {
  id: string; date: string; workoutId?: string; workoutName: string;
  duration: number; items: WorkoutItem[]; note?: string;
}

export class WorkoutJournalDB extends Dexie {
  exercises!: Table<Exercise, string>;
  workouts!: Table<Workout, string>;
  scheduled!: Table<Scheduled, string>;
  history!: Table<History, string>;

  constructor() {
    super('WJornalDB_v8');
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

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

const formatDuration = (secs: number) => {
  if (!secs || secs <= 0) return '--:--';
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
// 2. УНІВЕРСАЛЬНА МОДАЛКА ВИБОРУ / СТВОРЕННЯ ВПРАВИ
// ==========================================
function ExercisePickerModal({
  exercises,
  onSelect,
  onClose
}: {
  exercises: Exercise[] | undefined;
  onSelect: (ex: Exercise) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMuscle, setNewMuscle] = useState('Загальна');

  const filtered = (exercises || [])
    .filter(ex =>
      ex.name.toLowerCase().includes(search.toLowerCase()) ||
      (ex.muscle && ex.muscle.toLowerCase().includes(search.toLowerCase()))
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'uk-UA'));

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const newEx: Exercise = {
      id: generateId(),
      name: trimmed,
      category: 'Користувацькі',
      muscle: newMuscle
    };
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
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Назва вправи</label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Наприклад: Підтягування вузьким хватом"
                className="w-full p-3 border rounded-lg mt-1 bg-gray-50 font-medium"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Група м'язів</label>
              <select
                value={newMuscle}
                onChange={e => setNewMuscle(e.target.value)}
                className="w-full p-3 border rounded-lg mt-1 bg-white font-medium"
              >
                {MUSCLE_GROUPS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="flex gap-2 pt-3">
              <button onClick={() => setCreating(false)} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-bold">Назад</button>
              <button onClick={handleCreate} className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold">Зберегти і додати</button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-3 shrink-0 relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={18} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Пошук (назва або група)..."
                className="w-full p-2 pl-10 border rounded-lg shadow-sm bg-gray-50"
              />
            </div>

            <button
              onClick={() => { setNewName(search.trim()); setCreating(true); }}
              className="w-full mb-3 py-2.5 px-3 bg-blue-50 text-blue-600 rounded-lg font-bold border border-dashed border-blue-300 flex items-center justify-center gap-2 shrink-0 text-sm"
            >
              <Plus size={18} />
              {search.trim() ? `Створити «${search.trim()}»` : 'Створити нову вправу'}
            </button>

            <div className="space-y-2 overflow-y-auto flex-1 pb-4">
              {filtered.map(ex => (
                <button
                  key={ex.id}
                  onClick={() => onSelect(ex)}
                  className="w-full text-left p-3 bg-gray-50 border rounded-lg font-medium active:bg-gray-200 flex justify-between items-center"
                >
                  <span className="pr-2">{ex.name}</span>
                  <span className="text-[10px] text-gray-400 uppercase font-bold shrink-0">{ex.muscle || 'Загальна'}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="text-center text-gray-400 text-sm mt-4">Нічого не знайдено. Натисніть кнопку вище, щоб створити вправу.</div>
              )}
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
      setMode('FREE'); // Завжди відкривати "Фактичний час" при старті тренування
      localStorage.setItem('active_workout_backup', JSON.stringify(data));
      setFinishItems(
        data.plan?.items
          ? data.plan.items.map((i: any) => ({ ...i }))
          : data.workout?.items
          ? data.workout.items.map((i: any) => ({ ...i }))
          : []
      );
      navigate('/timer', { replace: true, state: null });
    } else if (!savedWorkoutData) {
      const backup = localStorage.getItem('active_workout_backup');
      if (backup) {
        try {
          const parsed = JSON.parse(backup);
          setSavedWorkoutData(parsed);
          setFinishItems(
            parsed.plan?.items
              ? parsed.plan.items.map((i: any) => ({ ...i }))
              : parsed.workout?.items
              ? parsed.workout.items.map((i: any) => ({ ...i }))
              : []
          );
        } catch (e) {}
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

  const beep = (freq: number, duration: number) => {
    if (!audioCtx.current) return;
    const osc = audioCtx.current.createOscillator();
    osc.connect(audioCtx.current.destination);
    osc.frequency.value = freq;
    osc.start();
    osc.stop(audioCtx.current.currentTime + duration);
  };
  const startSilentAudioLoop = () => {
    if (!audioCtx.current || silentOscRef.current) return;
    const osc = audioCtx.current.createOscillator();
    const gain = audioCtx.current.createGain();
    gain.gain.value = 0.001;
    osc.connect(gain);
    gain.connect(audioCtx.current.destination);
    osc.start();
    silentOscRef.current = osc;
  };
  const stopSilentAudioLoop = () => {
    if (silentOscRef.current) {
      silentOscRef.current.stop();
      silentOscRef.current.disconnect();
      silentOscRef.current = null;
    }
  };
  const initAudio = () => {
    if (!audioCtx.current) audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioCtx.current.resume();
  };
  const requestWakeLock = async () => {
    try { if ('wakeLock' in navigator) wakeLockRef.current = await (navigator as any).wakeLock.request('screen'); } catch (err) {}
  };
  const releaseWakeLock = () => {
    if (wakeLockRef.current) { wakeLockRef.current.release().catch(() => {}); wakeLockRef.current = null; }
  };

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && (isRunning || freePhase !== 'Зупинено')) requestWakeLock();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isRunning, freePhase]);

  useEffect(() => { if (phase === 'IDLE') setTimeLeft(Number(workTime) || 20); }, [workTime, phase]);

  useEffect(() => {
    let t: number;
    const safeWork = Number(workTime) || 20;
    const safeRest = Number(restTime) || 10;
    const safeRounds = Number(rounds) || 8;
    if (isRunning) {
      t = window.setInterval(() => {
        const now = Date.now();
        const remaining = Math.ceil((tabataEndTime.current - now) / 1000);
        if (remaining <= 3 && remaining > 0 && lastTabataBeep.current !== remaining) {
          beep(800, 0.1);
          lastTabataBeep.current = remaining;
        }
        if (remaining <= 0) {
          lastTabataBeep.current = 0;
          if (phase === 'PREP') {
            setPhase('WORK'); beep(1200, 0.5); tabataEndTime.current = Date.now() + safeWork * 1000;
          } else if (phase === 'WORK') {
            if (currentRound >= safeRounds) {
              setIsRunning(false); setPhase('IDLE'); beep(400, 1); releaseWakeLock(); stopSilentAudioLoop();
            } else {
              setPhase('REST'); beep(1200, 0.5); tabataEndTime.current = Date.now() + safeRest * 1000;
            }
          } else if (phase === 'REST') {
            setPhase('WORK'); setCurrentRound(r => r + 1); beep(1200, 0.5); tabataEndTime.current = Date.now() + safeWork * 1000;
          }
        } else {
          setTimeLeft(remaining);
        }
      }, 100);
    }
    return () => clearInterval(t);
  }, [isRunning, phase, currentRound, rounds, workTime, restTime]);

  const toggleTabata = () => {
    initAudio();
    if (!isRunning && phase === 'IDLE') {
      requestWakeLock(); startSilentAudioLoop(); setPhase('PREP'); setCurrentRound(1); tabataEndTime.current = Date.now() + 5 * 1000;
    } else if (!isRunning) {
      requestWakeLock(); startSilentAudioLoop(); tabataEndTime.current = Date.now() + timeLeft * 1000;
    } else {
      releaseWakeLock(); stopSilentAudioLoop();
    }
    setIsRunning(!isRunning);
  };

  const resetTabata = () => { setPhase('IDLE'); setIsRunning(false); releaseWakeLock(); stopSilentAudioLoop(); };

  useEffect(() => {
    let t: number;
    if (freePhase !== 'Зупинено') {
      lastFreeTick.current = Date.now();
      t = window.setInterval(() => {
        const now = Date.now();
        const deltaSec = (now - lastFreeTick.current) / 1000;
        lastFreeTick.current = now;
        setFreeTime(prev => prev + deltaSec);
        setPhaseTimes(prev => {
          if (freePhase === 'Розминка') return { ...prev, warmup: prev.warmup + deltaSec };
          if (freePhase === 'Основна') return { ...prev, main: prev.main + deltaSec };
          if (freePhase === 'Заминка') return { ...prev, cooldown: prev.cooldown + deltaSec };
          return prev;
        });
      }, 1000);
    }
    return () => clearInterval(t);
  }, [freePhase]);

  useEffect(() => {
    let t: number;
    if (isFreeResting) {
      t = window.setInterval(() => {
        const now = Date.now();
        const remaining = Math.ceil((freeRestEndTime.current - now) / 1000);
        if (remaining <= 5 && remaining > 0 && lastFreeRestBeep.current !== remaining) {
          beep(800, 0.1); lastFreeRestBeep.current = remaining;
        }
        if (remaining <= 0) {
          beep(1200, 0.5); setIsFreeResting(false); lastFreeRestBeep.current = 0;
        } else {
          setFreeRestTimeLeft(remaining);
        }
      }, 100);
    }
    return () => clearInterval(t);
  }, [isFreeResting]);

  const toggleFreeRest = () => {
    initAudio();
    if (!isFreeResting) {
      const safeTime = Number(freeRestTime) || 60;
      setFreeRestTimeLeft(safeTime);
      freeRestEndTime.current = Date.now() + safeTime * 1000;
      setIsFreeResting(true);
    } else {
      setIsFreeResting(false);
    }
  };

  const startFreePhase = (newPhase: 'Розминка' | 'Основна' | 'Заминка') => {
    initAudio(); requestWakeLock(); startSilentAudioLoop(); setFreePhase(newPhase);
  };

  const initiateStopFreeWorkout = () => {
    initAudio(); releaseWakeLock(); stopSilentAudioLoop(); setIsFreeResting(false); setFreePhase('Зупинено');
    if (savedWorkoutData) {
      setEditTimes({
        wm: Math.floor(phaseTimes.warmup / 60), ws: Math.floor(phaseTimes.warmup % 60),
        mm: Math.floor(phaseTimes.main / 60), ms: Math.floor(phaseTimes.main % 60),
        cm: Math.floor(phaseTimes.cooldown / 60), cs: Math.floor(phaseTimes.cooldown % 60)
      });
      setShowTimeEdit(true);
    } else {
      setFreeTime(0); setPhaseTimes({ warmup: 0, main: 0, cooldown: 0 });
    }
  };

  const clearActiveWorkout = () => {
    if (!window.confirm('Скасувати поточне тренування? Дані таймера будуть втрачені.')) return;
    localStorage.removeItem('active_workout_backup');
    setSavedWorkoutData(null); setFreeTime(0); setPhaseTimes({ warmup: 0, main: 0, cooldown: 0 });
    setFreePhase('Зупинено'); navigate('/');
  };

  const updateFinishItem = (index: number, field: keyof WorkoutItem, value: string) => {
    const newItems = finishItems.map(i => ({ ...i }));
    newItems[index] = { ...newItems[index], [field]: value };
    setFinishItems(newItems);
  };

  const saveFinalFreeWorkout = async () => {
    const fw = editTimes.wm * 60 + editTimes.ws;
    const fm = editTimes.mm * 60 + editTimes.ms;
    const fc = editTimes.cm * 60 + editTimes.cs;
    const ft = fw + fm + fc;
    const breakdownInfo = `[Розминка: ${formatDuration(fw)} | Основна: ${formatDuration(fm)} | Заминка: ${formatDuration(fc)}]`;
    const finalNote = workoutNote ? `${workoutNote}\n\n${breakdownInfo}` : breakdownInfo;
    const allExs = await db.exercises.toArray();
    const snapItems = finishItems.map(item => {
      const ex = allExs.find(e => e.id === item.exerciseId);
      return { ...item, exNameSnapshot: ex?.name, exMuscleSnapshot: ex?.muscle };
    });
    const recDate = savedWorkoutData?.plan?.date || getLocalDateString(new Date());
    const wId = savedWorkoutData?.plan?.workoutId || savedWorkoutData?.workout?.id;
    await db.history.add({
      id: generateId(), date: recDate, workoutId: wId, workoutName: activeName,
      duration: ft, items: snapItems, note: finalNote
    });
    if (savedWorkoutData?.plan?.id) await db.scheduled.delete(savedWorkoutData.plan.id);
    localStorage.removeItem('active_workout_backup');
    setSavedWorkoutData(null); setFreeTime(0); setPhaseTimes({ warmup: 0, main: 0, cooldown: 0 });
    setWorkoutNote(''); setShowTimeEdit(false); navigate('/');
  };

  const contextValue = {
    mode, setMode, savedWorkoutData, activeName,
    workTime, setWorkTime, restTime, setRestTime, rounds, setRounds,
    isRunning, phase, timeLeft, currentRound, toggleTabata, resetTabata,
    freeTime, freePhase, phaseTimes,
    freeRestTime, setFreeRestTime, freeRestTimeLeft, isFreeResting, toggleFreeRest,
    startFreePhase, initiateStopFreeWorkout, clearActiveWorkout,
    showTimeEdit, setShowTimeEdit, editTimes, setEditTimes,
    finishItems, setFinishItems, updateFinishItem,
    workoutNote, setWorkoutNote, saveFinalFreeWorkout,
    showFinishAddEx, setShowFinishAddEx
  };
  return <TimerContext.Provider value={contextValue}>{children}</TimerContext.Provider>;
}

// ==========================================
// 4. КАЛЕНДАР (МАТРИЦЯ 7 ДНІВ + БЕЗПЕРЕРВНИЙ МІСЯЦЬ)
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
  const [planSetup, setPlanSetup] = useState<{
    date: string; baseWorkoutId: string; editName: string; editItems: WorkoutItem[]; showAddEx: boolean;
  } | null>(null);
  const [planNote, setPlanNote] = useState('');

  const monthScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { if (!activePlanAction) setPlanNote(''); }, [activePlanAction]);

  const todayStr = getLocalDateString(new Date());

  // 7 видимих днів для матриці (5 минулих + сьогодні + 1 майбутній за замовчуванням)
  const visibleDays = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset + i - 5);
    return d;
  });

  // Безперервна стрічка тижнів для вкладки "Місяць" (±26 тижнів від currentDate)
  const continuousWeeks = useMemo(() => {
    const anchor = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const dayOfWeek = (anchor.getDay() + 6) % 7; // Пн = 0
    const startMonday = new Date(anchor);
    startMonday.setDate(anchor.getDate() - dayOfWeek - 26 * 7);

    const weeks: Date[][] = [];
    for (let w = 0; w < 56; w++) {
      const week: Date[] = [];
      for (let d = 0; d < 7; d++) {
        const dt = new Date(startMonday);
        dt.setDate(startMonday.getDate() + w * 7 + d);
        week.push(dt);
      }
      weeks.push(week);
    }
    return weeks;
  }, [currentDate.getFullYear(), currentDate.getMonth()]);

  // Прокрутка до 1-го числа обраного місяця або сьогоднішнього дня
  const scrollToMonthOrToday = (targetDate: Date) => {
    setTimeout(() => {
      const targetStr = getLocalDateString(targetDate);
      const el = document.getElementById(`cal-day-${targetStr}`);
      if (el && monthScrollRef.current) {
        const container = monthScrollRef.current;
        const offsetTop = el.offsetTop - container.offsetTop - 8;
        container.scrollTo({ top: Math.max(0, offsetTop), behavior: 'smooth' });
      }
    }, 60);
  };

  useEffect(() => {
    if (view === 'month') {
      const now = new Date();
      const isCurrentMonth =
        currentDate.getFullYear() === now.getFullYear() &&
        currentDate.getMonth() === now.getMonth();
      scrollToMonthOrToday(isCurrentMonth ? now : new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));
    }
  }, [view, currentDate]);

  const initiatePlanSetup = (date: string, workout: Workout) => {
    setPlanSetup({
      date,
      baseWorkoutId: workout.id,
      editName: workout.name,
      editItems: (workout.items || []).map(i => ({ ...i })),
      showAddEx: false
    });
  };

  const savePlanSetup = async () => {
    if (!planSetup) return;
    await db.scheduled.add({
      id: generateId(),
      date: planSetup.date,
      workoutId: planSetup.baseWorkoutId,
      name: planSetup.editName,
      items: planSetup.editItems,
      isCompleted: false
    });
    setPlanSetup(null);
  };

  const handleMarkDone = async (plan: Scheduled) => {
    const w = workouts?.find(x => x.id === plan.workoutId);
    const wName = plan.name || w?.name || 'Невідомо';
    const wItems = plan.items || w?.items || [];
    await db.history.add({
      id: generateId(), date: plan.date, workoutId: plan.workoutId,
      workoutName: wName, duration: 0, items: wItems, note: planNote
    });
    await db.scheduled.delete(plan.id);
    setActivePlanAction(null);
  };

  const handleStart = (plan: Scheduled, workout: Workout) => {
    setActivePlanAction(null);
    navigate('/timer', { state: { plan, workout } });
  };

  const handleCellClickMatrix = (dStr: string, workout: Workout, isPlanned: boolean, planObj?: Scheduled) => {
    if (isPlanned && planObj) setActivePlanAction(planObj);
    else initiatePlanSetup(dStr, workout);
  };

  const sortedWorkouts = workouts?.slice().sort((a, b) => a.name.localeCompare(b.name, 'uk-UA'));

  return (
    <div className="p-1.5 pb-24">
      <div className="flex justify-between items-center mb-3 px-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded">v3.1</span>
          <div className="flex bg-gray-200 rounded-lg p-0.5">
            <button className={`px-3 py-1 rounded-md text-xs font-bold ${view === 'matrix' ? 'bg-white shadow' : ''}`} onClick={() => setView('matrix')}>Таблиця</button>
            <button className={`px-3 py-1 rounded-md text-xs font-bold ${view === 'month' ? 'bg-white shadow' : ''}`} onClick={() => setView('month')}>Місяць</button>
          </div>
        </div>
        <button
          onClick={() => { const now = new Date(); setCurrentDate(now); setDayOffset(0); if (view === 'month') scrollToMonthOrToday(now); }}
          className="text-blue-600 font-bold text-xs bg-blue-50 px-3 py-1.5 rounded-lg"
        >
          Сьогодні
        </button>
      </div>

      {/* ВКЛАДКА МІСЯЦЬ (БЕЗПЕРЕРВНИЙ СКРОЛ ПО ТИЖНЯХ) */}
      {view === 'month' && (
        <div className="bg-white rounded-xl shadow-sm p-2.5 mx-0.5 flex flex-col">
          <div className="flex gap-2 mb-2.5">
            <select
              value={currentDate.getMonth()}
              onChange={e => { const d = new Date(currentDate.getFullYear(), Number(e.target.value), 1); setCurrentDate(d); }}
              className="p-2 border rounded-lg font-bold bg-gray-50 flex-1 text-sm capitalize"
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <option key={i} value={i}>{new Date(2000, i).toLocaleDateString('uk-UA', { month: 'long' })}</option>
              ))}
            </select>
            <select
              value={currentDate.getFullYear()}
              onChange={e => { const d = new Date(Number(e.target.value), currentDate.getMonth(), 1); setCurrentDate(d); }}
              className="p-2 border rounded-lg font-bold bg-gray-50 w-24 text-sm"
            >
              {[2024, 2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] mb-1.5 text-gray-500 font-bold border-b pb-1">
            <div>Пн</div><div>Вт</div><div>Ср</div><div>Чт</div><div>Пт</div><div>Сб</div><div>Нд</div>
          </div>

          <div ref={monthScrollRef} className="overflow-y-auto max-h-[68vh] space-y-1 pr-0.5">
            {continuousWeeks.map((week, wIdx) => (
              <div key={wIdx} className="grid grid-cols-7 gap-1">
                {week.map(day => {
                  const dStr = getLocalDateString(day);
                  const plans = scheduled?.filter(s => s.date === dStr) || [];
                  const hists = historyData?.filter(h => h.date === dStr) || [];
                  const isFirstOfMonth = day.getDate() === 1;
                  const isAltMonth = day.getMonth() % 2 === 1;

                  let bgClass = isAltMonth ? 'bg-gray-50/90 border-gray-100' : 'bg-white border-gray-100';
                  let textClass = 'text-gray-700';
                  let content = null;

                  if (hists.length > 0) {
                    const wObj = workouts?.find(w => w.id === hists[0].workoutId || w.name === hists[0].workoutName);
                    const muscleLabel = wObj?.muscle || hists[0].workoutName.slice(0, 6);
                    bgClass = 'bg-green-100 border-green-300 shadow-sm';
                    textClass = 'text-green-800 font-bold';
                    content = (
                      <div className="flex flex-col items-center mt-0.5 leading-tight">
                        <span className="text-[9px] font-bold truncate max-w-[44px]">{muscleLabel}</span>
                        <span className="text-[9px] font-mono opacity-85">{formatDuration(hists[0].duration)}</span>
                      </div>
                    );
                  } else if (plans.length > 0) {
                    const wObj = workouts?.find(w => w.id === plans[0].workoutId);
                    const pName = plans[0].name || wObj?.name || '?';
                    bgClass = 'bg-blue-50 border-blue-300 shadow-sm';
                    textClass = 'text-blue-900 font-bold';
                    content = (
                      <div className="flex flex-col items-center mt-0.5 leading-tight">
                        <span className="text-sm text-blue-600 font-black leading-none">{pName.charAt(0).toUpperCase()}</span>
                        <span className="text-[8px] font-mono text-blue-400">план</span>
                      </div>
                    );
                  }

                  return (
                    <div
                      id={`cal-day-${dStr}`}
                      key={dStr}
                      onClick={() => setDayDetailsDate(dStr)}
                      className={`min-h-[58px] flex flex-col items-center pt-1 pb-1 rounded-md text-xs cursor-pointer border ${bgClass} ${textClass} ${dStr === todayStr ? 'ring-2 ring-blue-500' : ''} ${isFirstOfMonth ? 'border-t-2 border-t-blue-400' : ''}`}
                    >
                      <span className="text-[10px] leading-none font-bold">
                        {day.getDate()}
                        {isFirstOfMonth && (
                          <span className="text-[8px] text-blue-600 uppercase ml-0.5">
                            {day.toLocaleDateString('uk-UA', { month: 'short' }).replace('.', '')}
                          </span>
                        )}
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

      {/* ВКЛАДКА ТАБЛИЦЯ (КОМПАКТНА НА 7 ДНІВ) */}
      {view === 'matrix' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto relative">
          <table className="w-full text-left border-collapse table-fixed">
            <thead>
              <tr>
                <th className="sticky left-0 bg-white z-10 p-1 border-b border-r w-[82px]">
                  <div className="flex justify-between items-center bg-gray-100 rounded p-0.5">
                    <button onClick={() => setDayOffset(d => d - 1)} className="p-1 bg-white rounded shadow-sm text-gray-600 active:bg-gray-200"><ChevronLeft size={14} /></button>
                    <button onClick={() => setDayOffset(d => d + 1)} className="p-1 bg-white rounded shadow-sm text-gray-600 active:bg-gray-200"><ChevronRight size={14} /></button>
                  </div>
                </th>
                {visibleDays.map(day => {
                  const dStr = getLocalDateString(day);
                  const isToday = dStr === todayStr;
                  return (
                    <th key={dStr} className={`py-1 px-0.5 border-b text-center ${isToday ? 'bg-blue-50' : ''}`}>
                      <div className={`text-[9px] uppercase leading-none ${isToday ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
                        {day.toLocaleDateString('uk-UA', { weekday: 'short' })}
                      </div>
                      <div className={`text-[11px] font-bold leading-tight mt-0.5 ${isToday ? 'text-blue-700' : 'text-gray-800'}`}>
                        {day.getDate()}.{(day.getMonth() + 1).toString().padStart(2, '0')}
                      </div>
                      <button
                        onClick={() => setPlanModalDate(dStr)}
                        className="mt-1 w-5 h-5 mx-auto rounded-full bg-blue-50 text-blue-600 flex items-center justify-center active:bg-blue-200"
                      >
                        <Plus size={12} />
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortedWorkouts?.map(w => (
                <tr key={w.id} className="hover:bg-gray-50">
                  <td className="sticky left-0 bg-white z-10 p-1.5 border-b border-r w-[82px]" style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
                    <div className="text-[8px] font-bold text-gray-400 uppercase leading-none mb-0.5">{w.muscle || 'Загальна'}</div>
                    <div className="text-[10px] font-bold text-gray-800 leading-tight">{w.name}</div>
                  </td>
                  {visibleDays.map(day => {
                    const dStr = getLocalDateString(day);
                    const isToday = dStr === todayStr;
                    const hist = historyData?.find(h => h.date === dStr && (h.workoutId === w.id || h.workoutName === w.name));
                    const plan = scheduled?.find(s => s.date === dStr && s.workoutId === w.id);
                    const firstLetter = (plan?.name || w.name).charAt(0).toUpperCase();

                    return (
                      <td key={dStr} className={`p-0.5 border-b text-center align-middle border-l border-gray-100 ${isToday && !hist ? 'bg-blue-50/40' : ''}`}>
                        {hist ? (
                          <div
                            onClick={() => setActiveHistoryAction(hist)}
                            className="bg-green-100 text-green-800 rounded flex flex-col items-center justify-center cursor-pointer hover:bg-green-200 w-full h-11 border border-green-200"
                          >
                            <span className="text-sm font-black leading-none">{firstLetter}</span>
                            <span className="text-[8px] mt-0.5 font-mono leading-none">{formatDuration(hist.duration)}</span>
                          </div>
                        ) : plan ? (
                          <button
                            onClick={() => handleCellClickMatrix(dStr, w, true, plan)}
                            className="bg-blue-500 text-white rounded w-full h-11 shadow-sm active:bg-blue-600 flex flex-col items-center justify-center"
                          >
                            <span className="text-sm font-black leading-none">{firstLetter}</span>
                            <span className="text-[8px] mt-0.5 font-mono text-blue-100 leading-none">план</span>
                          </button>
                        ) : (
                          <div
                            onClick={() => handleCellClickMatrix(dStr, w, false)}
                            className="h-11 w-full rounded flex items-center justify-center hover:bg-gray-100 cursor-pointer text-gray-300"
                          >
                            <Plus size={13} />
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

      {/* Модалка: Корекція тренування при плануванні */}
      {planSetup && (
        <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-[110] p-2 pb-16">
          <div className="bg-white w-full max-w-md rounded-2xl p-4 shadow-2xl max-h-[88vh] flex flex-col">
            <div className="flex justify-between items-center mb-3 border-b pb-2">
              <h3 className="font-bold text-lg">План на {planSetup.date}</h3>
              <button onClick={() => setPlanSetup(null)} className="text-gray-400 bg-gray-100 rounded-full p-1"><X size={20} /></button>
            </div>

            <input
              value={planSetup.editName}
              onChange={e => setPlanSetup({ ...planSetup, editName: e.target.value })}
              placeholder="Назва плану"
              className="w-full p-2.5 border rounded-lg mb-3 font-bold bg-gray-50"
            />

            <div className="flex-1 overflow-y-auto space-y-2.5 mb-3">
              {planSetup.editItems.map((item, idx) => {
                const exName = exercises?.find(e => e.id === item.exerciseId)?.name || 'Вправа';
                return (
                  <div key={idx} className="p-3 bg-white border rounded-xl shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-sm text-blue-800">{exName}</span>
                      <button
                        onClick={() => {
                          const next = [...planSetup.editItems];
                          next.splice(idx, 1);
                          setPlanSetup({ ...planSetup, editItems: next });
                        }}
                        className="text-red-400"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[9px] text-gray-400 uppercase font-bold">Вага</label>
                        <input
                          type="text"
                          value={item.weight}
                          onChange={e => { const n = [...planSetup.editItems]; n[idx] = { ...n[idx], weight: e.target.value }; setPlanSetup({ ...planSetup, editItems: n }); }}
                          className="w-full p-2 border rounded text-xs bg-gray-50"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-400 uppercase font-bold">Еспандер</label>
                        <input
                          type="text"
                          value={item.band}
                          onChange={e => { const n = [...planSetup.editItems]; n[idx] = { ...n[idx], band: e.target.value }; setPlanSetup({ ...planSetup, editItems: n }); }}
                          className="w-full p-2 border rounded text-xs bg-gray-50"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-400 uppercase font-bold">Повтори</label>
                        <input
                          type="text"
                          inputMode="text"
                          placeholder="5x8"
                          value={item.reps}
                          onChange={e => { const n = [...planSetup.editItems]; n[idx] = { ...n[idx], reps: e.target.value }; setPlanSetup({ ...planSetup, editItems: n }); }}
                          className="w-full p-2 border rounded text-xs bg-gray-50"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              <button
                onClick={() => setPlanSetup({ ...planSetup, showAddEx: true })}
                className="w-full py-3 bg-blue-50 text-blue-600 rounded-lg font-bold border border-dashed border-blue-300 flex justify-center items-center gap-2"
              >
                <Plus size={18} /> Додати вправу
              </button>
            </div>

            <div className="flex gap-3 mt-auto shrink-0">
              <button onClick={() => setPlanSetup(null)} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-bold">Скасувати</button>
              <button onClick={savePlanSetup} className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold flex justify-center items-center gap-2"><Save size={18} /> Зберегти</button>
            </div>
          </div>

          {planSetup.showAddEx && (
            <ExercisePickerModal
              exercises={exercises}
              onClose={() => setPlanSetup({ ...planSetup, showAddEx: false })}
              onSelect={ex => {
                setPlanSetup({
                  ...planSetup,
                  editItems: [...planSetup.editItems, { exerciseId: ex.id, weight: '', band: '', reps: '', note: '' }],
                  showAddEx: false
                });
              }}
            />
          )}
        </div>
      )}

      {/* Модалка: Деталі дня */}
      {dayDetailsDate && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-[100] pb-20">
          <div className="bg-white w-full rounded-t-2xl p-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h3 className="font-bold text-lg">Деталі за {dayDetailsDate}</h3>
              <button onClick={() => setDayDetailsDate(null)} className="text-gray-400 bg-gray-100 rounded-full p-1"><X size={20} /></button>
            </div>

            {historyData?.filter(h => h.date === dayDetailsDate).map(h => (
              <div key={h.id} className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-green-800 text-lg">✓ {h.workoutName}</span>
                  <span className="text-sm font-mono bg-green-100 text-green-800 px-2 py-1 rounded">{formatDuration(h.duration)}</span>
                </div>
                {h.note && <div className="text-xs text-gray-700 bg-white p-2 rounded border border-green-100 whitespace-pre-wrap mb-2">{h.note}</div>}
                <button onClick={() => db.history.delete(h.id)} className="mt-2 w-full bg-red-100 text-red-600 p-2 rounded-lg font-bold flex justify-center items-center gap-2"><Trash2 size={16} /> Видалити запис</button>
              </div>
            ))}

            {scheduled?.filter(s => s.date === dayDetailsDate).map(p => {
              const w = workouts?.find(x => x.id === p.workoutId);
              const displayName = p.name || w?.name || 'Видалене';
              return (
                <div key={p.id} className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-xl">
                  <div className="font-bold text-gray-800 mb-3 text-lg">ПЛАН: {displayName}</div>
                  <div className="flex gap-2">
                    <button onClick={() => { setDayDetailsDate(null); if (w) handleStart(p, w); }} className="flex-1 bg-blue-500 text-white p-3 rounded-lg font-bold text-xs flex justify-center items-center gap-1"><Play size={16} /> СТАРТ</button>
                    <button onClick={() => { setDayDetailsDate(null); setActivePlanAction(p); }} className="flex-1 bg-gray-200 text-gray-800 p-3 rounded-lg font-bold text-xs flex justify-center items-center gap-1"><CheckCircle2 size={16} /> ВІДМІТИТИ</button>
                    <button onClick={() => db.scheduled.delete(p.id)} className="bg-red-50 text-red-500 p-3 rounded-lg"><Trash2 size={16} /></button>
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
              <button onClick={() => setActivePlanAction(null)} className="text-gray-400 bg-gray-100 rounded-full p-1"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => { const w = workouts?.find(x => x.id === activePlanAction.workoutId); if (w) handleStart(activePlanAction, w); }}
                className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm"
              >
                <Play size={20} /> Почати тренування (Фактичний час)
              </button>
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                <textarea value={planNote} onChange={e => setPlanNote(e.target.value)} placeholder="Додати примітку..." className="w-full p-3 border rounded-lg mb-3 bg-white text-sm min-h-[70px]" />
                <button onClick={() => handleMarkDone(activePlanAction)} className="w-full bg-gray-200 text-gray-800 p-3 rounded-lg font-bold flex items-center justify-center gap-2">
                  <CheckCircle2 size={18} /> Відмітити ВИКОНАНО
                </button>
              </div>
              <button onClick={async () => { await db.scheduled.delete(activePlanAction.id); setActivePlanAction(null); }} className="w-full bg-red-50 text-red-600 p-3 rounded-xl font-bold flex items-center justify-center gap-2">
                <Trash2 size={18} /> Видалити план
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка: Історія з матриці */}
      {activeHistoryAction && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-[100] pb-20">
          <div className="bg-white w-full rounded-t-2xl p-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h3 className="font-bold text-lg text-green-800 flex items-center gap-2"><CheckCircle2 /> {activeHistoryAction.workoutName}</h3>
              <button onClick={() => setActiveHistoryAction(null)} className="text-gray-400 bg-gray-100 rounded-full p-1"><X size={20} /></button>
            </div>
            <div className="mb-3">
              <div className="text-xs text-gray-500 font-bold uppercase">Час виконання</div>
              <div className="text-3xl font-mono text-gray-800">{formatDuration(activeHistoryAction.duration)}</div>
            </div>
            {activeHistoryAction.items && activeHistoryAction.items.length > 0 && (
              <div className="mb-4 bg-gray-50 p-3 rounded-xl border space-y-1.5">
                <div className="text-xs text-gray-500 font-bold uppercase mb-1">Вправи</div>
                {activeHistoryAction.items.map((it, idx) => {
                  const name = it.exNameSnapshot || exercises?.find(e => e.id === it.exerciseId)?.name || 'Вправа';
                  return (
                    <div key={idx} className="text-xs flex justify-between border-b border-gray-200/60 pb-1 last:border-0">
                      <span className="font-medium text-gray-800 pr-2">{name}</span>
                      <span className="font-mono text-gray-600 shrink-0">{[it.weight, it.band, it.reps].filter(Boolean).join(' | ') || '-'}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {activeHistoryAction.note && (
              <div className="mb-4 bg-gray-50 p-3 rounded-xl border">
                <div className="text-xs text-gray-500 font-bold mb-1 uppercase">Примітка</div>
                <div className="text-sm text-gray-800 whitespace-pre-wrap">{activeHistoryAction.note}</div>
              </div>
            )}
            <button onClick={() => { db.history.delete(activeHistoryAction.id); setActiveHistoryAction(null); }} className="w-full bg-red-100 text-red-600 p-3.5 rounded-xl font-bold flex items-center justify-center gap-2">
              <Trash2 size={18} /> Видалити з історії
            </button>
          </div>
        </div>
      )}

      {/* Модалка: Вибір шаблону для дня */}
      {planModalDate && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-[100] pb-20">
          <div className="bg-white w-full rounded-t-2xl p-4 max-h-[70vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">План на {planModalDate}</h3>
              <button onClick={() => setPlanModalDate(null)} className="text-red-500 bg-red-50 rounded-full p-1"><X size={20} /></button>
            </div>
            <div className="space-y-2">
              {sortedWorkouts?.map(w => (
                <button
                  key={w.id}
                  onClick={() => { const d = planModalDate; setPlanModalDate(null); initiatePlanSetup(d, w); }}
                  className="w-full text-left p-4 bg-gray-50 rounded-xl font-bold border active:bg-gray-200 shadow-sm flex justify-between items-center"
                >
                  <span>{w.name}</span>
                  <span className="text-[10px] text-gray-400 uppercase">{w.muscle || 'Загальна'}</span>
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
// 5. РЕДАКТОР ШАБЛОНІВ ТРЕНУВАНЬ
// ==========================================
function Workouts() {
  const workouts = useLiveQuery(() => db.workouts.toArray());
  const exercises = useLiveQuery(() => db.exercises.toArray());
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState('Загальна');
  const [items, setItems] = useState<WorkoutItem[]>([]);
  const [showAddEx, setShowAddEx] = useState(false);

  const startEdit = (w: Workout | null) => {
    if (w) { setEditingId(w.id); setName(w.name); setMuscle(w.muscle || 'Загальна'); setItems(w.items || []); }
    else { setEditingId('new'); setName(''); setMuscle('Загальна'); setItems([]); }
  };

  const saveWorkout = async () => {
    if (!name.trim()) return;
    const data = { name, muscle, items, note: '' };
    if (editingId === 'new') await db.workouts.add({ id: generateId(), ...data });
    else if (editingId) await db.workouts.update(editingId, data);
    setEditingId(null);
  };

  const updateItem = (index: number, field: keyof WorkoutItem, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const moveItem = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
  };

  if (editingId) {
    return (
      <div className="p-4 pb-24">
        <div className="flex justify-between items-center mb-4">
          <button onClick={() => setEditingId(null)} className="text-gray-500 font-bold">Скасувати</button>
          <button onClick={saveWorkout} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex gap-2"><Save size={20} /> Зберегти</button>
        </div>

        <input value={name} onChange={e => setName(e.target.value)} placeholder="Назва тренування" className="w-full p-3 border rounded-lg mb-3 font-bold text-lg shadow-sm" />
        <select value={muscle} onChange={e => setMuscle(e.target.value)} className="w-full p-3 border rounded-lg mb-5 bg-white font-medium shadow-sm">
          {MUSCLE_GROUPS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        <div className="space-y-3 mb-5">
          {items.map((item, idx) => {
            const ex = exercises?.find(e => e.id === item.exerciseId);
            return (
              <div key={idx} className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-bold text-blue-800 leading-tight pr-2">{ex?.name || 'Невідома вправа'}</div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase">{ex?.muscle || 'Загальна'}</div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => moveItem(idx, -1)} disabled={idx === 0} className="text-gray-500 disabled:opacity-20 p-1 bg-gray-100 rounded"><ChevronUp size={18} /></button>
                    <button onClick={() => moveItem(idx, 1)} disabled={idx === items.length - 1} className="text-gray-500 disabled:opacity-20 p-1 bg-gray-100 rounded"><ChevronDown size={18} /></button>
                    <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-red-500 bg-red-50 p-1 rounded ml-1"><Trash2 size={18} /></button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold uppercase">Вага</label>
                    <input type="text" value={item.weight} onChange={e => updateItem(idx, 'weight', e.target.value)} placeholder="24 кг" className="w-full p-2 border rounded text-sm bg-gray-50" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold uppercase">Еспандер</label>
                    <input type="text" value={item.band} onChange={e => updateItem(idx, 'band', e.target.value)} placeholder="Червоний" className="w-full p-2 border rounded text-sm bg-gray-50" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold uppercase">Повтори</label>
                    <input type="text" inputMode="text" value={item.reps} onChange={e => updateItem(idx, 'reps', e.target.value)} placeholder="5x8" className="w-full p-2 border rounded text-sm bg-gray-50" />
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
          <ExercisePickerModal
            exercises={exercises}
            onClose={() => setShowAddEx(false)}
            onSelect={ex => {
              setItems([...items, { exerciseId: ex.id, weight: '', band: '', reps: '', note: '' }]);
              setShowAddEx(false);
            }}
          />
        )}
      </div>
    );
  }

  const sortedWorkouts = workouts?.slice().sort((a, b) => a.name.localeCompare(b.name, 'uk-UA'));

  return (
    <div className="p-4 pb-24">
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-2xl font-bold">Шаблони тренувань</h2>
        <button onClick={() => startEdit(null)} className="bg-blue-600 text-white p-2 rounded-lg shadow-sm"><Plus /></button>
      </div>
      <div className="space-y-3">
        {sortedWorkouts?.map(w => (
          <div key={w.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase">{w.muscle || 'Загальна'}</div>
                <h3 className="font-bold text-lg text-blue-800">{w.name}</h3>
              </div>
              <div className="flex gap-3">
                <button onClick={() => startEdit(w)} className="text-gray-400 p-1"><Edit2 size={18} /></button>
                <button onClick={() => db.workouts.delete(w.id)} className="text-red-400 bg-red-50 p-1 rounded"><Trash2 size={18} /></button>
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
// 6. ДОВІДНИК ВПРАВ
// ==========================================
function Exercises() {
  const exercises = useLiveQuery(() => db.exercises.toArray());
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formMuscle, setFormMuscle] = useState('Загальна');

  const openForm = (ex?: Exercise) => {
    if (ex) { setEditId(ex.id); setFormName(ex.name); setFormMuscle(ex.muscle || 'Загальна'); }
    else { setEditId(null); setFormName(''); setFormMuscle('Загальна'); }
    setModalOpen(true);
  };

  const saveExercise = async () => {
    if (!formName.trim()) return;
    if (editId) await db.exercises.update(editId, { name: formName, muscle: formMuscle });
    else await db.exercises.add({ id: generateId(), name: formName, category: 'Користувацькі', muscle: formMuscle });
    setModalOpen(false);
  };

  const filtered = exercises
    ?.filter(ex =>
      ex.name.toLowerCase().includes(search.toLowerCase()) ||
      (ex.muscle && ex.muscle.toLowerCase().includes(search.toLowerCase()))
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'uk-UA')) || [];

  return (
    <div className="p-4 pb-24">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Довідник вправ</h2>
        <button onClick={() => openForm()} className="bg-blue-600 text-white p-2 rounded-lg shadow-sm"><Plus /></button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-3 text-gray-400" size={18} />
        <input className="w-full p-2 pl-10 border rounded-lg shadow-sm bg-gray-50" placeholder="Пошук за назвою або групою..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="space-y-2">
        {filtered.map(ex => (
          <div key={ex.id} className="bg-white p-3 rounded-lg shadow-sm border-l-4 border-blue-500 flex justify-between items-center">
            <div>
              <div className="font-medium text-gray-800">{ex.name}</div>
              <div className="text-[10px] font-bold text-gray-400 uppercase mt-0.5">{ex.muscle || 'Загальна'}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => openForm(ex)} className="text-gray-400 p-1"><Edit2 size={16} /></button>
              <button onClick={() => db.exercises.delete(ex.id)} className="text-red-400 p-1 bg-red-50 rounded"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white w-full max-w-sm rounded-xl p-5 shadow-xl">
            <h3 className="font-bold text-lg mb-4">{editId ? 'Редагувати вправу' : 'Нова вправа'}</h3>
            <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Назва вправи" className="w-full p-3 border rounded-lg mb-3 shadow-sm" />
            <select value={formMuscle} onChange={e => setFormMuscle(e.target.value)} className="w-full p-3 border rounded-lg mb-6 shadow-sm bg-white font-medium">
              {MUSCLE_GROUPS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <div className="flex gap-3">
              <button onClick={() => setModalOpen(false)} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-bold">Скасувати</button>
              <button onClick={saveExercise} className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold shadow-sm">Зберегти</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 7. ЕКРАН ТАЙМЕРІВ
// ==========================================
function NumberControl({ label, value, setValue }: { label: string; value: number | ''; setValue: (v: any) => void }) {
  return (
    <div className="flex items-center justify-between w-full py-2 border-b border-gray-100 last:border-0">
      <div className="text-sm text-gray-500 font-bold uppercase">{label}</div>
      <div className="flex items-center gap-2">
        <button onClick={() => setValue((v: any) => Math.max(1, (Number(v) || 1) - 1))} className="w-11 h-11 flex items-center justify-center bg-gray-100 rounded-xl text-2xl font-bold text-gray-600 active:bg-gray-200">-</button>
        <input type="number" value={value} onChange={e => setValue(e.target.value === '' ? '' : Math.max(1, Number(e.target.value)))} className="w-14 text-center font-bold text-xl bg-transparent outline-none" />
        <button onClick={() => setValue((v: any) => (Number(v) || 0) + 1)} className="w-11 h-11 flex items-center justify-center bg-gray-100 rounded-xl text-2xl font-bold text-gray-600 active:bg-gray-200">+</button>
      </div>
    </div>
  );
}

function Timers() {
  const t = useTimer();
  const exercises = useLiveQuery(() => db.exercises.toArray());

  return (
    <div className="p-4 pb-24 relative">
      {t.savedWorkoutData && (
        <div className="bg-blue-100 border border-blue-300 p-3 rounded-lg mb-4 flex justify-between items-center shadow-sm">
          <span className="font-bold text-blue-800 text-sm">Виконується: {t.activeName}</span>
          <button onClick={t.clearActiveWorkout} className="text-blue-500 bg-white rounded-full p-1"><X size={16} /></button>
        </div>
      )}

      <div className="flex justify-center gap-2 mb-2">
        {t.isRunning && t.mode !== 'TABATA' && <div className="text-[10px] bg-red-100 text-red-600 px-2 py-1 rounded font-bold animate-pulse">ТАБАТА ПРАЦЮЄ</div>}
        {t.freePhase !== 'Зупинено' && t.mode !== 'FREE' && <div className="text-[10px] bg-blue-100 text-blue-600 px-2 py-1 rounded font-bold animate-pulse">ОСН. ТАЙМЕР ПРАЦЮЄ</div>}
      </div>

      <div className="flex bg-gray-200 rounded-lg p-1 mb-5">
        <button className={`flex-1 py-2 font-bold rounded-md ${t.mode === 'TABATA' ? 'bg-white shadow' : 'text-gray-500'}`} onClick={() => t.setMode('TABATA')}>Табата</button>
        <button className={`flex-1 py-2 font-bold rounded-md ${t.mode === 'FREE' ? 'bg-white shadow' : 'text-gray-500'}`} onClick={() => t.setMode('FREE')}>Фактичний час</button>
      </div>

      {t.mode === 'TABATA' ? (
        <div className="flex flex-col items-center">
          {!t.isRunning && t.phase === 'IDLE' && (
            <div className="w-full bg-white p-4 rounded-xl shadow-sm mb-5">
              <NumberControl label="Робота (сек)" value={t.workTime} setValue={t.setWorkTime} />
              <NumberControl label="Відпочинок (сек)" value={t.restTime} setValue={t.setRestTime} />
              <NumberControl label="Цикли" value={t.rounds} setValue={t.setRounds} />
            </div>
          )}
          <div className={`w-60 h-60 rounded-full flex flex-col items-center justify-center text-white shadow-lg transition-colors ${t.phase === 'WORK' ? 'bg-red-500' : t.phase === 'REST' ? 'bg-green-500' : t.phase === 'PREP' ? 'bg-yellow-500' : 'bg-gray-800'}`}>
            <span className="text-xl font-bold">{t.phase === 'WORK' ? 'РОБОТА' : t.phase === 'REST' ? 'ВІДПОЧИНОК' : t.phase === 'PREP' ? 'ПРИГОТУВАТИСЬ' : 'ГОТОВИЙ'}</span>
            <span className="text-6xl font-mono mt-2">{formatDuration(t.timeLeft)}</span>
            {t.phase !== 'IDLE' && <span className="text-base mt-2">Цикл {t.currentRound}/{t.rounds}</span>}
          </div>
          <button onClick={t.toggleTabata} className="mt-8 bg-blue-600 text-white px-8 py-4 rounded-xl text-xl font-bold w-full shadow-lg">
            {t.isRunning ? 'ПАУЗА' : t.phase === 'IDLE' ? 'СТАРТ' : 'ПРОДОВЖИТИ'}
          </button>
          {t.phase !== 'IDLE' && !t.isRunning && (
            <button onClick={t.resetTabata} className="mt-3 text-red-600 px-8 py-3 rounded-xl font-bold w-full">Скинути</button>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center w-full">
          <div className="text-6xl font-mono mt-2 mb-1">{formatDuration(t.freeTime)}</div>
          <div className="text-base font-bold mb-4 text-blue-600 uppercase">{t.freePhase}</div>

          <div className="w-full flex justify-between bg-white p-3 rounded-xl shadow-sm mb-4 border border-gray-100">
            <div className="text-center w-1/3">
              <div className="text-[10px] text-gray-400 font-bold uppercase">Розминка</div>
              <div className={`font-mono text-base ${t.freePhase === 'Розминка' ? 'text-yellow-500 font-bold' : 'text-gray-700'}`}>{formatDuration(t.phaseTimes.warmup)}</div>
            </div>
            <div className="text-center w-1/3 border-l border-r border-gray-100">
              <div className="text-[10px] text-gray-400 font-bold uppercase">Основна</div>
              <div className={`font-mono text-base ${t.freePhase === 'Основна' ? 'text-red-500 font-bold' : 'text-gray-700'}`}>{formatDuration(t.phaseTimes.main)}</div>
            </div>
            <div className="text-center w-1/3">
              <div className="text-[10px] text-gray-400 font-bold uppercase">Заминка</div>
              <div className={`font-mono text-base ${t.freePhase === 'Заминка' ? 'text-green-500 font-bold' : 'text-gray-700'}`}>{formatDuration(t.phaseTimes.cooldown)}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 w-full mb-4">
            <button onClick={() => t.startFreePhase('Розминка')} className={`py-3 rounded-xl font-bold text-xs shadow-sm ${t.freePhase === 'Розминка' ? 'bg-yellow-400 text-black ring-2 ring-yellow-500' : 'bg-gray-100 text-gray-700'}`}>Розминка</button>
            <button onClick={() => t.startFreePhase('Основна')} className={`py-3 rounded-xl font-bold text-xs shadow-sm ${t.freePhase === 'Основна' ? 'bg-red-500 text-white ring-2 ring-red-500' : 'bg-gray-100 text-gray-700'}`}>Основна</button>
            <button onClick={() => t.startFreePhase('Заминка')} className={`py-3 rounded-xl font-bold text-xs shadow-sm ${t.freePhase === 'Заминка' ? 'bg-green-500 text-white ring-2 ring-green-500' : 'bg-gray-100 text-gray-700'}`}>Заминка</button>
          </div>

          {/* Таймер відпочинку між підходами */}
          <div className="w-full bg-white p-3 rounded-xl border border-gray-200 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500 uppercase">Відпочинок (сек):</span>
              <input
                type="number"
                value={t.freeRestTime}
                onChange={e => t.setFreeRestTime(e.target.value === '' ? '' : Math.max(5, Number(e.target.value)))}
                className="w-14 p-1 border rounded text-center font-bold text-sm"
                disabled={t.isFreeResting}
              />
            </div>
            <button
              onClick={t.toggleFreeRest}
              className={`px-4 py-2 rounded-lg font-bold text-xs ${t.isFreeResting ? 'bg-orange-500 text-white animate-pulse' : 'bg-blue-50 text-blue-600'}`}
            >
              {t.isFreeResting ? `Зупинити (${t.freeRestTimeLeft}с)` : 'Старт'}
            </button>
          </div>

          {/* Список вправ поточного тренування */}
          {t.savedWorkoutData && t.finishItems.length > 0 && (
            <div className="w-full bg-white p-3 rounded-xl border border-gray-200 mb-4 space-y-2">
              <div className="text-xs font-bold text-gray-400 uppercase">План вправ</div>
              {t.finishItems.map((item: WorkoutItem, idx: number) => {
                const exName = exercises?.find(e => e.id === item.exerciseId)?.name || 'Вправа';
                return (
                  <div key={idx} className="flex justify-between text-xs border-b border-gray-100 pb-1.5 last:border-0">
                    <span className="font-bold text-gray-800 pr-2">{exName}</span>
                    <span className="font-mono text-gray-500 shrink-0">{[item.weight, item.band, item.reps].filter(Boolean).join(' | ') || '-'}</span>
                  </div>
                );
              })}
            </div>
          )}

          <button
            onClick={t.initiateStopFreeWorkout}
            className="w-full bg-gray-800 text-white py-4 rounded-xl font-bold shadow-lg"
          >
            {t.savedWorkoutData ? 'Завершити тренування' : 'Скинути таймер'}
          </button>
        </div>
      )}

      {/* Модалка: Підсумки та редагування перед збереженням */}
      {t.showTimeEdit && t.savedWorkoutData && (
        <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-[110] p-2 pb-16">
          <div className="bg-white w-full max-w-md rounded-2xl p-4 shadow-2xl max-h-[88vh] flex flex-col">
            <h3 className="font-bold text-xl mb-3 text-center">Підсумки тренування</h3>

            <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-0.5">
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-yellow-50 p-2.5 rounded-lg border border-yellow-200 text-sm">
                  <span className="font-bold text-yellow-800">Розминка</span>
                  <div className="flex items-center gap-1">
                    <input type="number" min="0" value={t.editTimes.wm} onChange={e => t.setEditTimes({ ...t.editTimes, wm: Number(e.target.value) })} className="w-11 text-center p-1 border rounded bg-white font-mono" /> хв
                    <input type="number" min="0" max="59" value={t.editTimes.ws} onChange={e => t.setEditTimes({ ...t.editTimes, ws: Number(e.target.value) })} className="w-11 text-center p-1 border rounded bg-white font-mono ml-1" /> с
                  </div>
                </div>
                <div className="flex items-center justify-between bg-red-50 p-2.5 rounded-lg border border-red-200 text-sm">
                  <span className="font-bold text-red-800">Основна</span>
                  <div className="flex items-center gap-1">
                    <input type="number" min="0" value={t.editTimes.mm} onChange={e => t.setEditTimes({ ...t.editTimes, mm: Number(e.target.value) })} className="w-11 text-center p-1 border rounded bg-white font-mono" /> хв
                    <input type="number" min="0" max="59" value={t.editTimes.ms} onChange={e => t.setEditTimes({ ...t.editTimes, ms: Number(e.target.value) })} className="w-11 text-center p-1 border rounded bg-white font-mono ml-1" /> с
                  </div>
                </div>
                <div className="flex items-center justify-between bg-green-50 p-2.5 rounded-lg border border-green-200 text-sm">
                  <span className="font-bold text-green-800">Заминка</span>
                  <div className="flex items-center gap-1">
                    <input type="number" min="0" value={t.editTimes.cm} onChange={e => t.setEditTimes({ ...t.editTimes, cm: Number(e.target.value) })} className="w-11 text-center p-1 border rounded bg-white font-mono" /> хв
                    <input type="number" min="0" max="59" value={t.editTimes.cs} onChange={e => t.setEditTimes({ ...t.editTimes, cs: Number(e.target.value) })} className="w-11 text-center p-1 border rounded bg-white font-mono ml-1" /> с
                  </div>
                </div>
                <div className="text-center font-bold text-lg">
                  Всього: {formatDuration((t.editTimes.wm * 60 + t.editTimes.ws) + (t.editTimes.mm * 60 + t.editTimes.ms) + (t.editTimes.cm * 60 + t.editTimes.cs))}
                </div>
              </div>

              <div className="space-y-2">
                {t.finishItems.map((item: WorkoutItem, idx: number) => {
                  const exName = exercises?.find(e => e.id === item.exerciseId)?.name || 'Вправа';
                  return (
                    <div key={idx} className="p-2.5 bg-gray-50 border rounded-lg">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="font-bold text-xs text-blue-800">{exName}</span>
                        <button onClick={() => t.setFinishItems(t.finishItems.filter((_: any, i: number) => i !== idx))} className="text-red-400"><Trash2 size={14} /></button>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        <input type="text" placeholder="Вага" value={item.weight} onChange={e => t.updateFinishItem(idx, 'weight', e.target.value)} className="p-1.5 border rounded text-xs bg-white" />
                        <input type="text" placeholder="Еспандер" value={item.band} onChange={e => t.updateFinishItem(idx, 'band', e.target.value)} className="p-1.5 border rounded text-xs bg-white" />
                        <input type="text" inputMode="text" placeholder="Повтори" value={item.reps} onChange={e => t.updateFinishItem(idx, 'reps', e.target.value)} className="p-1.5 border rounded text-xs bg-white" />
                      </div>
                    </div>
                  );
                })}
                <button onClick={() => t.setShowFinishAddEx(true)} className="w-full py-2 bg-blue-50 text-blue-600 rounded-lg font-bold text-xs border border-dashed border-blue-300">
                  + Додати вправу
                </button>
              </div>

              <textarea value={t.workoutNote} onChange={e => t.setWorkoutNote(e.target.value)} placeholder="Примітка до тренування..." className="w-full p-2.5 border rounded-lg bg-gray-50 text-sm min-h-[70px]" />
            </div>

            <div className="flex gap-3 shrink-0">
              <button onClick={() => t.setShowTimeEdit(false)} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-bold">Скасувати</button>
              <button onClick={t.saveFinalFreeWorkout} className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2"><Save size={18} /> Зберегти</button>
            </div>
          </div>

          {t.showFinishAddEx && (
            <ExercisePickerModal
              exercises={exercises}
              onClose={() => t.setShowFinishAddEx(false)}
              onSelect={ex => {
                t.setFinishItems([...t.finishItems, { exerciseId: ex.id, weight: '', band: '', reps: '', note: '' }]);
                t.setShowFinishAddEx(false);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ==========================================
// 8. ДАНІ ТА ЕКСПОРТ ДЛЯ АНАЛІЗУ (CSV)
// ==========================================
function DataSync() {
  const [csvPeriod, setCsvPeriod] = useState<'all' | '30' | '7'>('all');
  const [copyStatus, setCopyStatus] = useState('');

  const buildAnalysisCSV = async () => {
    const history = await db.history.toArray();
    const exercises = await db.exercises.toArray();
    const workouts = await db.workouts.toArray();

    let filtered = history.sort((a, b) => a.date.localeCompare(b.date));
    if (csvPeriod !== 'all') {
      const days = Number(csvPeriod);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffStr = getLocalDateString(cutoff);
      filtered = filtered.filter(h => h.date >= cutoffStr);
    }

    const esc = (val: string | number | undefined) => {
      const s = String(val ?? '').replace(/\r?\n/g, ' ').replace(/"/g, '""');
      return `"${s}"`;
    };

    const header = ['Дата', 'Тренування', 'Група м\'язів', 'Загальний час', 'Розминка', 'Основна', 'Заминка', 'Вправа', 'Вага', 'Еспандер', 'Повтори', 'Примітка'];
    const rows: string[] = [header.map(esc).join(',')];

    for (const h of filtered) {
      const w = workouts.find(x => x.id === h.workoutId || x.name === h.workoutName);
      const wMuscle = w?.muscle || 'Загальна';
      const noteText = h.note || '';
      const breakdownMatch = noteText.match(/\[Розминка:\s*([^|]+)\|\s*Основна:\s*([^|]+)\|\s*Заминка:\s*([^\]]+)\]/);
      const warmup = breakdownMatch ? breakdownMatch[1].trim() : '';
      const main = breakdownMatch ? breakdownMatch[2].trim() : '';
      const cooldown = breakdownMatch ? breakdownMatch[3].trim() : '';
      const cleanNote = noteText.replace(/\[Розминка:[^\]]+\]/, '').trim();

      const items = h.items && h.items.length > 0 ? h.items : [{ exerciseId: '', weight: '', band: '', reps: '', note: '' }];
      for (const item of items) {
        const ex = exercises.find(e => e.id === item.exerciseId);
        const exName = item.exNameSnapshot || ex?.name || '';
        rows.push([
          h.date, h.workoutName, wMuscle, formatDuration(h.duration),
          warmup, main, cooldown, exName, item.weight, item.band, item.reps, cleanNote
        ].map(esc).join(','));
      }
    }
    return rows.join('\n');
  };

  const downloadCSV = async () => {
    const csv = await buildAnalysisCSV();
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `w_jornal_analysis_${getLocalDateString(new Date())}.csv`;
    a.click();
  };

  const copyCSV = async () => {
    const csv = await buildAnalysisCSV();
    try {
      await navigator.clipboard.writeText(csv);
      setCopyStatus('Скопійовано! Можна вставляти в чат.');
      setTimeout(() => setCopyStatus(''), 3000);
    } catch {
      alert('Не вдалося скопіювати автоматично. Скористайтесь кнопкою «Завантажити CSV».');
    }
  };

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
    reader.onload = async event => {
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
        alert('Дані успішно відновлено! Сторінка оновиться.');
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
      <h2 className="text-2xl font-bold mb-5">Хмара / Дані</h2>
      <div className="space-y-4">
        {/* Блок експорту для аналізу */}
        <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm">
          <h3 className="font-bold text-blue-800 mb-2">Аналіз тренувань (CSV)</h3>
          <select value={csvPeriod} onChange={e => setCsvPeriod(e.target.value as any)} className="w-full p-2.5 border rounded-lg mb-3 bg-gray-50 text-sm font-medium">
            <option value="all">За весь час</option>
            <option value="30">За останні 30 днів</option>
            <option value="7">За останні 7 днів</option>
          </select>
          <div className="flex gap-2">
            <button onClick={downloadCSV} className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-1.5">
              <Download size={16} /> Завантажити CSV
            </button>
            <button onClick={copyCSV} className="flex-1 bg-blue-50 text-blue-700 py-3 rounded-lg font-bold text-sm border border-blue-200 flex items-center justify-center gap-1.5">
              <Copy size={16} /> Скопіювати звіт
            </button>
          </div>
          {copyStatus && <div className="text-xs text-green-600 font-bold mt-2 text-center">{copyStatus}</div>}
        </div>

        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <h3 className="font-bold mb-2">Експорт (Повний бекап JSON)</h3>
          <button onClick={exportData} className="w-full bg-gray-800 text-white py-3 rounded-lg font-bold">Вивантажити бекап</button>
        </div>

        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <h3 className="font-bold mb-2">Відновлення з файлу JSON</h3>
          <input type="file" accept=".json" onChange={importData} className="w-full text-sm" />
        </div>

        <div className="bg-red-50 p-4 rounded-xl border border-red-200 mt-6">
          <h3 className="font-bold text-red-700 mb-2">Небезпечна зона</h3>
          <button onClick={clearPhone} className="w-full bg-red-600 text-white py-3 rounded-lg font-bold">Очистити телефон</button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 9. НАВІГАЦІЯ ТА ІНІЦІАЛІЗАЦІЯ
// ==========================================
export default function App() {
  useEffect(() => {
    const initDb = async () => {
      const exCount = await db.exercises.count();
      if (exCount === 0) {
        const insertedExercises = initialExercises.map(ex => ({ id: generateId(), ...ex }));
        await db.exercises.bulkAdd(insertedExercises);
        const workoutsToInsert = initialWorkouts.map(w => {
          const items = w.exercises
            .map(exName => {
              const foundEx = insertedExercises.find(e => e.name === exName);
              return { exerciseId: foundEx ? foundEx.id : '', weight: '', band: '', reps: '', note: '' };
            })
            .filter(item => item.exerciseId !== '');
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
      </TimerProvider>
    </BrowserRouter>
  );
}
