import Dexie, { Table } from 'dexie';

export interface Exercise { id: string; name: string; category: string; muscle?: string; }
export interface WorkoutItem { exerciseId: string; weight: string; band: string; reps: string; note: string; exNameSnapshot?: string; exMuscleSnapshot?: string; }
export interface Workout { id: string; name: string; items: WorkoutItem[]; note: string; muscle?: string; muscles?: string[]; }
export interface Scheduled { id: string; date: string; workoutId: string; isCompleted: boolean; name?: string; items?: WorkoutItem[]; }
export interface History { id: string; date: string; workoutId?: string; workoutName: string; duration: number; items: WorkoutItem[]; note?: string; }

export class WorkoutJournalDB extends Dexie {
  exercises!: Table<Exercise, string>; workouts!: Table<Workout, string>;
  scheduled!: Table<Scheduled, string>; history!: Table<History, string>;
  constructor() {
    super('WJornalDB_v7');
    this.version(1).stores({ exercises: 'id, name, category', workouts: 'id, name', scheduled: 'id, date', history: 'id, date' });
  }
}
export const db = new WorkoutJournalDB();
export const MUSCLE_GROUPS = ['Груди', 'Ноги', 'Спина', 'Плечі', 'Руки', 'Загальна'];
export const generateId = () => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substring(2);
export const formatDuration = (secs: number) => { if (!secs || secs === 0) return '--:--'; const m = Math.floor(secs / 60); const s = Math.floor(secs % 60); return `${m}:${s.toString().padStart(2, '0')}`; };
export const getLocalDateString = (d: Date) => { const year = d.getFullYear(); const month = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0'); return `${year}-${month}-${day}`; };

export const initialExercises = [
  { category: 'МИНОТАВР', name: 'ГОБЛЕТ-присидання', muscle: 'Ноги' }, { category: 'МИНОТАВР', name: 'ПРОТЯЖКА до подборіддя', muscle: 'Плечі' },
  { category: 'МИНОТАВР', name: 'МАХИ 2 руками', muscle: 'Загальна' }, { category: 'МИНОТАВР', name: 'ТЯГА В НАКЛОНІ до поясу', muscle: 'Спина' },
  { category: 'МИНОТАВР', name: 'СТАНОВА ТЯГА з гірею', muscle: 'Спина' }, { category: 'НОГИ', name: 'ПРИСІДАННЯ з ЕСПАНДЕРОМ', muscle: 'Ноги' },
  { category: 'ДРАБИНА з ГИРЕЮ', name: 'ВІДЖИМАННЯ', muscle: 'Груди' }, { category: 'ТРАСТЕР', name: 'ТРАСТЕР з еспандером', muscle: 'Загальна' },
  { category: 'БРУСИ', name: 'ВІДЖИМАННЯ на брусах', muscle: 'Груди' }, { category: 'ДЕЛЬТИ', name: 'ЖИМ ЕСПАНДЕРА над головою', muscle: 'Плечі' },
  { category: 'СПИНА', name: 'ПІДТЯГУВАННЯ', muscle: 'Спина' }
];
export const initialWorkouts = [ { name: 'МИНОТАВР', muscle: 'Загальна', exercises: ['ГОБЛЕТ-присидання', 'ПРОТЯЖКА до подборіддя', 'МАХИ 2 руками', 'ТЯГА В НАКЛОНІ до поясу', 'СТАНОВА ТЯГА з гірею'] } ];