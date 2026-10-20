import { Navigate, Route, Routes } from 'react-router';
import { EditIndex } from './EditIndex';
import { BookEditor } from './books/BookEditor';
import { BookList } from './books/BookList';
import { DayEditor } from './day/DayEditor';
import { DayList } from './day/DayList';
import { GoalEditor } from './goals/GoalEditor';
import { GoalList } from './goals/GoalList';
import { VisionEditor } from './goals/VisionEditor';
import { PersonEditor } from './people/PersonEditor';
import { PersonList } from './people/PersonList';
import { RoutineEditor } from './routines/RoutineEditor';
import { RoutineList } from './routines/RoutineList';
import { SkillEditor } from './skills/SkillEditor';
import { SkillList } from './skills/SkillList';

/**
 * Mounted at `edit/*`. Every list has `new` and `:id`:
 *
 *   /edit                         index
 *   /edit/routines[/new|/:id]     ?pillar=BODY preselects a pillar on new
 *   /edit/goals[/new|/:id]        ?pillar=SKIN preselects a region on new
 *   /edit/goals/vision/new|/:id   a vision item, with or without a goal
 *   /edit/skills[/new|/:id]
 *   /edit/people[/new|/:id]
 *   /edit/books[/new|/:id]
 *   /edit/days                    the last 60 days, and a jump-to-date box
 *   /edit/day/:date               one past day: its log, meals and notes
 */
export function EditorsRoutes() {
  return (
    <Routes>
      <Route index element={<EditIndex />} />
      <Route path="routines" element={<RoutineList />} />
      <Route path="routines/new" element={<RoutineEditor />} />
      <Route path="routines/:id" element={<RoutineEditor />} />
      <Route path="goals" element={<GoalList />} />
      <Route path="goals/new" element={<GoalEditor />} />
      <Route path="goals/vision/new" element={<VisionEditor />} />
      <Route path="goals/vision/:id" element={<VisionEditor />} />
      <Route path="goals/:id" element={<GoalEditor />} />
      <Route path="skills" element={<SkillList />} />
      <Route path="skills/new" element={<SkillEditor />} />
      <Route path="skills/:id" element={<SkillEditor />} />
      <Route path="people" element={<PersonList />} />
      <Route path="people/new" element={<PersonEditor />} />
      <Route path="people/:id" element={<PersonEditor />} />
      <Route path="books" element={<BookList />} />
      <Route path="books/new" element={<BookEditor />} />
      <Route path="books/:id" element={<BookEditor />} />
      <Route path="days" element={<DayList />} />
      <Route path="day/:date" element={<DayEditor />} />
      <Route path="*"element={<Navigate to="/edit" replace />} />
    </Routes>
  );
}
