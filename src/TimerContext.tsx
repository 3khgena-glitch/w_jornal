import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { db, generateId, getLocalDateString, formatDuration, WorkoutItem, Scheduled, Workout } from './db';

const TimerContext = createContext<any>(null);
export const useTimer = () => useContext(TimerContext);

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation(); const navigate = useNavigate();
  const [savedWorkoutData, setSavedWorkoutData] = useState<{ plan: Scheduled, workout: Workout } | null>(null);
  const [finishItems, setFinishItems] = useState<WorkoutItem[]>([]);

  useEffect(() => {
    if (location.pathname === '/timer' && location.state) {
      const data = location.state as any; setSavedWorkoutData(data); localStorage.setItem('active_workout_backup', JSON.stringify(data));
      setFinishItems(data.plan?.items ? data.plan.items.map((i:any)=>({...i})) : (data.workout?.items ? data.workout.items.map((i:any)=>({...i})) : []));
      navigate('/timer', { replace: true, state: null });
    } else if (!savedWorkoutData) {
      const backup = localStorage.getItem('active_workout_backup');
      if (backup) { try { const parsed = JSON.parse(backup); setSavedWorkoutData(parsed); setFinishItems(parsed.plan?.items ? parsed.plan.items.map((i:any)=>({...i})) : (parsed.workout?.items ? parsed.workout.items.map((i:any)=>({...i})) : [])); } catch(e) {} }
    }
  }, [location.pathname, location.state, navigate]);

  const [mode, setMode] = useState<'TABATA' | 'FREE'>(localStorage.getItem('active_workout_backup') ? 'FREE' : 'TABATA');
  const audioCtx = useRef<AudioContext | null>(null); const wakeLockRef = useRef<any>(null); const silentOscRef = useRef<any>(null);
  
  const [workTime, setWorkTime] = useState<number | ''>(() => Number(localStorage.getItem('tabata_work')) || 20);
  const [restTime, setRestTime] = useState<number | ''>(() => Number(localStorage.getItem('tabata_rest')) || 10);
  const [rounds, setRounds] = useState<number | ''>(() => Number(localStorage.getItem('tabata_rounds')) || 8);
  const [isRunning, setIsRunning] = useState(false); const [phase, setPhase] = useState<'PREP' | 'WORK' | 'REST' | 'IDLE'>('IDLE');
  const [timeLeft, setTimeLeft] = useState(Number(workTime) || 20); const [currentRound, setCurrentRound] = useState(1);
  const tabataEndTime = useRef(0); const lastTabataBeep = useRef(0);

  const [freeTime, setFreeTime] = useState(0); const [freePhase, setFreePhase] = useState<'Розминка' | 'Основна' | 'Заминка' | 'Зупинено'>('Зупинено');
  const [workoutNote, setWorkoutNote] = useState(''); const [phaseTimes, setPhaseTimes] = useState({ warmup: 0, main: 0, cooldown: 0 });
  const lastFreeTick = useRef(Date.now());

  const [freeRestTime, setFreeRestTime] = useState<number | ''>(() => Number(localStorage.getItem('free_rest_time')) || 60);
  const [freeRestTimeLeft, setFreeRestTimeLeft] = useState(Number(freeRestTime) || 60);
  const [isFreeResting, setIsFreeResting] = useState(false); const freeRestEndTime = useRef(0); const lastFreeRestBeep = useRef(0);

  const [showTimeEdit, setShowTimeEdit] = useState(false); const [editTimes, setEditTimes] = useState({ wm:0, ws:0, mm:0, ms:0, cm:0, cs:0 });
  const [showFinishAddEx, setShowFinishAddEx] = useState(false); const [finishExSearch, setFinishExSearch] = useState('');
  const activeName = savedWorkoutData?.plan?.name || savedWorkoutData?.workout?.name || '';

  useEffect(() => {
    if (typeof workTime === 'number') localStorage.setItem('tabata_work', String(workTime));
    if (typeof restTime === 'number') localStorage.setItem('tabata_rest', String(restTime));
    if (typeof rounds === 'number') localStorage.setItem('tabata_rounds', String(rounds));
    if (typeof freeRestTime === 'number') localStorage.setItem('free_rest_time', String(freeRestTime));
  }, [workTime, restTime, rounds, freeRestTime]);

  const beep = (freq: number, duration: number) => { if (!audioCtx.current) return; const osc = audioCtx.current.createOscillator(); osc.connect(audioCtx.current.destination); osc.frequency.value = freq; osc.start(); osc.stop(audioCtx.current.currentTime + duration); };
  const startSilentAudioLoop = () => { if (!audioCtx.current || silentOscRef.current) return; const osc = audioCtx.current.createOscillator(); const gain = audioCtx.current.createGain(); gain.gain.value = 0.001; osc.connect(gain); gain.connect(audioCtx.current.destination); osc.start(); silentOscRef.current = osc; };
  const stopSilentAudioLoop = () => { if (silentOscRef.current) { silentOscRef.current.stop(); silentOscRef.current.disconnect(); silentOscRef.current = null; } };
  const initAudio = () => { if (!audioCtx.current) audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)(); audioCtx.current.resume(); };
  const requestWakeLock = async () => { try { if ('wakeLock' in navigator) wakeLockRef.current = await (navigator as any).wakeLock.request('screen'); } catch (err) {} };
  const releaseWakeLock = () => { if (wakeLockRef.current) { wakeLockRef.current.release().catch(()=>{}); wakeLockRef.current = null; } };

  useEffect(() => { const handleVisibility = () => { if (document.visibilityState === 'visible' && (isRunning || freePhase !== 'Зупинено')) requestWakeLock(); }; document.addEventListener('visibilitychange', handleVisibility); return () => document.removeEventListener('visibilitychange', handleVisibility); }, [isRunning, freePhase]);
  useEffect(() => { if (phase === 'IDLE') setTimeLeft(Number(workTime) || 20); }, [workTime, phase]);

  useEffect(() => {
    let t: number; const safeWork = Number(workTime) || 20; const safeRest = Number(restTime) || 10; const safeRounds = Number(rounds) || 8;
    if (isRunning) {
      t = window.setInterval(() => {
        const now = Date.now(); const remaining = Math.ceil((tabataEndTime.current - now) / 1000);
        if (remaining <= 3 && remaining > 0 && lastTabataBeep.current !== remaining) { beep(800, 0.1); lastTabataBeep.current = remaining; }
        if (remaining <= 0) { lastTabataBeep.current = 0; if (phase === 'PREP') { setPhase('WORK'); beep(1200, 0.5); tabataEndTime.current = Date.now() + safeWork * 1000; } else if (phase === 'WORK') { if (currentRound >= safeRounds) { setIsRunning(false); setPhase('IDLE'); beep(400, 1); releaseWakeLock(); stopSilentAudioLoop(); } else { setPhase('REST'); beep(1200, 0.5); tabataEndTime.current = Date.now() + safeRest * 1000; } } else if (phase === 'REST') { setPhase('WORK'); setCurrentRound(r => r + 1); beep(1200, 0.5); tabataEndTime.current = Date.now() + safeWork * 1000; } } else { setTimeLeft(remaining); }
      }, 100);
    }
    return () => clearInterval(t);
  }, [isRunning, phase, currentRound, rounds, workTime, restTime]);

  const toggleTabata = () => { initAudio(); if (!isRunning && phase === 'IDLE') { requestWakeLock(); startSilentAudioLoop(); setPhase('PREP'); setCurrentRound(1); tabataEndTime.current = Date.now() + 5 * 1000; } else if (!isRunning) { requestWakeLock(); startSilentAudioLoop(); tabataEndTime.current = Date.now() + timeLeft * 1000; } else { releaseWakeLock(); stopSilentAudioLoop(); } setIsRunning(!isRunning); };

  useEffect(() => { let t: number; if (freePhase !== 'Зупинено') { lastFreeTick.current = Date.now(); t = window.setInterval(() => { const now = Date.now(); const deltaSec = (now - lastFreeTick.current) / 1000; lastFreeTick.current = now; setFreeTime(prev => prev + deltaSec); setPhaseTimes(prev => { if (freePhase === 'Розминка') return { ...prev, warmup: prev.warmup + deltaSec }; if (freePhase === 'Основна') return { ...prev, main: prev.main + deltaSec }; if (freePhase === 'Заминка') return { ...prev, cooldown: prev.cooldown + deltaSec }; return prev; }); }, 1000); } return () => clearInterval(t); }, [freePhase]);
  useEffect(() => { let t: number; if (isFreeResting) { t = window.setInterval(() => { const now = Date.now(); const remaining = Math.ceil((freeRestEndTime.current - now) / 1000); if (remaining <= 5 && remaining > 0 && lastFreeRestBeep.current !== remaining) { beep(800, 0.1); lastFreeRestBeep.current = remaining; } if (remaining <= 0) { beep(1200, 0.5); setIsFreeResting(false); lastFreeRestBeep.current = 0; } else { setFreeRestTimeLeft(remaining); } }, 100); } return () => clearInterval(t); }, [isFreeResting]);

  const toggleFreeRest = () => { initAudio(); if (!isFreeResting) { const safeTime = Number(freeRestTime) || 60; setFreeRestTimeLeft(safeTime); freeRestEndTime.current = Date.now() + safeTime * 1000; setIsFreeResting(true); } else { setIsFreeResting(false); } };
  const startFreePhase = (newPhase: 'Розминка' | 'Основна' | 'Заминка') => { initAudio(); requestWakeLock(); startSilentAudioLoop(); setFreePhase(newPhase); };

  const initiateStopFreeWorkout = () => { initAudio(); releaseWakeLock(); stopSilentAudioLoop(); setIsFreeResting(false); setFreePhase('Зупинено'); if (savedWorkoutData) { setEditTimes({ wm: Math.floor(phaseTimes.warmup / 60), ws: Math.floor(phaseTimes.warmup % 60), mm: Math.floor(phaseTimes.main / 60), ms: Math.floor(phaseTimes.main % 60), cm: Math.floor(phaseTimes.cooldown / 60), cs: Math.floor(phaseTimes.cooldown % 60) }); setShowTimeEdit(true); } else { setFreeTime(0); setPhaseTimes({ warmup: 0, main: 0, cooldown: 0 }); } };
  
  const clearActiveWorkout = () => { if (!window.confirm('Скасувати поточне тренування? Дані таймера будуть втрачені.')) return; localStorage.removeItem('active_workout_backup'); setSavedWorkoutData(null); setFreeTime(0); setPhaseTimes({ warmup: 0, main: 0, cooldown: 0 }); setFreePhase('Зупинено'); navigate('/'); };
  const updateFinishItem = (index: number, field: keyof WorkoutItem, value: string) => { const newItems = finishItems.map(i => ({...i})); newItems[index] = { ...newItems[index], [field]: value }; setFinishItems(newItems); };

  const saveFinalFreeWorkout = async () => {
    const fw = editTimes.wm * 60 + editTimes.ws; const fm = editTimes.mm * 60 + editTimes.ms; const fc = editTimes.cm * 60 + editTimes.cs; const ft = fw + fm + fc;
    const breakdownInfo = `[Розминка: ${formatDuration(fw)} | Основна: ${formatDuration(fm)} | Заминка: ${formatDuration(fc)}]`; const finalNote = workoutNote ? `${workoutNote}\n\n${breakdownInfo}` : breakdownInfo;
    const allExs = await db.exercises.toArray();
    const snapItems = finishItems.map(item => { const ex = allExs.find(e => e.id === item.exerciseId); return { ...item, exNameSnapshot: ex?.name, exMuscleSnapshot: ex?.muscle }; });
    const recDate = savedWorkoutData?.plan?.date || getLocalDateString(new Date()); const wId = savedWorkoutData?.plan?.workoutId || savedWorkoutData?.workout?.id;
    await db.history.add({ id: generateId(), date: recDate, workoutId: wId, workoutName: activeName, duration: ft, items: snapItems, note: finalNote });
    if (savedWorkoutData?.plan?.id) await db.scheduled.delete(savedWorkoutData.plan.id);
    localStorage.removeItem('active_workout_backup'); setSavedWorkoutData(null); setFreeTime(0); setPhaseTimes({ warmup: 0, main: 0, cooldown: 0 }); setShowTimeEdit(false); navigate('/');
  };

  const contextValue = { mode, setMode, savedWorkoutData, activeName, workTime, setWorkTime, restTime, setRestTime, rounds, setRounds, isRunning, phase, timeLeft, currentRound, toggleTabata, freeTime, freePhase, phaseTimes, freeRestTime, setFreeRestTime, freeRestTimeLeft, isFreeResting, toggleFreeRest, startFreePhase, initiateStopFreeWorkout, clearActiveWorkout, showTimeEdit, setShowTimeEdit, editTimes, setEditTimes, finishItems, setFinishItems, updateFinishItem, workoutNote, setWorkoutNote, saveFinalFreeWorkout, showFinishAddEx, setShowFinishAddEx, finishExSearch, setFinishExSearch };
  return <TimerContext.Provider value={contextValue}>{children}</TimerContext.Provider>;
}