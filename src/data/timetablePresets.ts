import type { Base, TimetableEntry } from './types';

export type TimetableDraft = Omit<TimetableEntry, keyof Base>;

export interface TimetablePreset {
  id: string;
  title: string;
  sub: string;
  entries: TimetableDraft[];
}

const MON = 1;
const TUE = 2;
const WED = 3;
const THU = 4;
const FRI = 5;
const FROM = '2026-07-20';

function slot(day: number, start: string, end: string, title: string, room?: string, teacher?: string, kind: TimetableEntry['kind'] = 'class', code?: string): TimetableDraft {
  return { day, start, end, title, kind, room, teacher, code, from: FROM };
}

/** PDEU School of Technology, B.Tech Computer Engineering, Semester 5, Division 5, batch G10, odd semester 2026. */
export const PDEU_SEM5_DIV5_G10: TimetablePreset = {
  id: 'pdeu-sem5-div5-g10',
  title: 'PDEU B.Tech CE, Sem 5, Div 5, G10',
  sub: 'Odd semester 2026, from 20 July. No classes on Saturday.',
  entries: [
    ...[MON, TUE, WED, THU, FRI].map((d) => slot(d, '08:00', '08:55', 'Minor', undefined, undefined, 'minor')),
    ...[MON, TUE, WED, THU, FRI].map((d) => slot(d, '10:55', '11:10', 'Short break', undefined, undefined, 'break')),
    ...[MON, TUE, WED, THU, FRI].map((d) => slot(d, '16:05', '16:15', 'Short break', undefined, undefined, 'break')),
    slot(MON, '13:10', '14:05', 'Lunch break', undefined, undefined, 'break'),
    ...[TUE, WED, THU, FRI].map((d) => slot(d, '12:10', '13:05', 'Lunch break', undefined, undefined, 'break')),

    slot(MON, '09:00', '09:55', 'Computer Network', 'E307', 'Pooja S'),
    slot(MON, '11:10', '12:05', 'CD Cell', 'E307', 'CD Cell Trainer'),
    slot(MON, '12:10', '13:05', 'Introduction to Artificial Intelligence', 'E307', 'Chahat Gupta'),
    slot(MON, '14:10', '15:05', 'Compiler Design', 'F1-302', 'Ashish Patel'),
    slot(MON, '15:10', '16:05', 'Operating System', 'F1-302', 'Shilpa Pandey'),
    slot(MON, '16:15', '17:10', 'Engineering Economics', 'E308', 'Chuleshwar Naik'),

    slot(TUE, '10:00', '10:55', 'Computer Network', 'E203', 'Pooja S'),
    slot(TUE, '13:10', '14:05', 'Data Mining and Data Warehousing', 'E203', 'Bhoomi Bangoria'),
    slot(TUE, '14:10', '15:05', 'Operating System', 'F1-303', 'Shilpa Pandey'),

    slot(WED, '09:00', '09:55', 'Engineering Economics', 'F1-304', 'Chuleshwar Naik'),
    slot(WED, '10:00', '10:55', 'Introduction to Artificial Intelligence', 'F1-304', 'Chahat Gupta'),
    slot(WED, '13:10', '14:05', 'Data Mining and Data Warehousing', 'E203', 'Bhoomi Bangoria'),
    slot(WED, '14:10', '15:05', 'Operating System', 'F-504', 'Shilpa Pandey'),
    slot(WED, '15:10', '16:05', 'Compiler Design', 'F-504', 'Ashish Patel'),
    slot(WED, '16:15', '18:10', 'Operating System Laboratory', undefined, undefined, 'lab'),

    slot(THU, '09:00', '09:55', 'Compiler Design', 'E203', 'Ashish Patel'),
    slot(THU, '11:10', '12:05', 'CD Cell', 'E307', 'CD Cell Trainer'),
    slot(THU, '13:10', '14:05', 'Data Mining and Data Warehousing', 'E203', 'Bhoomi Bangoria'),
    slot(THU, '14:10', '16:05', 'Computer Networks Laboratory', 'E215', 'Pooja S', 'lab', '24CS382P'),
    slot(THU, '16:15', '17:10', 'Introduction to Artificial Intelligence', 'E203', 'Chahat Gupta'),

    slot(FRI, '10:00', '10:55', 'Computer Network', 'E203', 'Pooja S'),
    slot(FRI, '13:10', '14:05', 'Engineering Economics', 'E203', 'Chuleshwar Naik'),
    slot(FRI, '14:10', '16:05', 'Compiler Design Laboratory', 'E310', 'Ashish Patel', 'lab', '24CS383P'),
  ],
};

export const TIMETABLE_PRESETS: readonly TimetablePreset[] = [PDEU_SEM5_DIV5_G10];
