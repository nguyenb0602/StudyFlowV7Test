import test from 'node:test';
import assert from 'node:assert/strict';
import { studyPlan, studyPriorities, recommendationText, daysUntil } from '../src/lib/studyPriorities.js';

const course = (confidence) => ({ id: 'c1', department: 'CSCE', code: '3444', name: 'Software Engineering', confidence });
const event = (date, type = 'Exam') => ({ id: 'e1', courseId: 'c1', title: 'Final', type, date });
const priority = (confidence, date, type = 'Exam') => studyPriorities([course(confidence)], [event(date, type)], '2026-11-17')[0];

test('low confidence gets more focused study time than high confidence for the same exam', () => {
  const low = studyPlan(priority(1, '2026-11-18'));
  const high = studyPlan(priority(5, '2026-11-18'));
  assert.equal(low.totalMinutes, 105);
  assert.equal(high.totalMinutes, 50);
  assert.match(recommendationText(priority(1, '2026-11-18')), /rebuild the fundamentals/);
  assert.match(recommendationText(priority(5, '2026-11-18')), /quick topic checklist/);
});

test('a closer deadline increases planned study time at the same confidence', () => {
  const today = studyPlan(priority(3, '2026-11-17'));
  const tomorrow = studyPlan(priority(3, '2026-11-18'));
  const far = studyPlan(priority(3, '2026-12-01'));
  assert.ok(today.totalMinutes > tomorrow.totalMinutes);
  assert.ok(tomorrow.totalMinutes > far.totalMinutes);
  assert.match(recommendationText(priority(3, '2026-11-17')), /today/);
});

test('event type changes the focus of suggested activities', () => {
  const exam = recommendationText(priority(3, '2026-11-20', 'Exam'));
  const assignment = recommendationText(priority(3, '2026-11-20', 'Assignment'));
  assert.match(exam, /exam-style questions/);
  assert.match(assignment, /complete the next concrete section/);
  assert.match(assignment, /is due/);
});

test('a same-day assignment emphasizes finishing and checking the submission', () => {
  const plan = studyPlan(priority(5, '2026-11-17', 'Assignment'));
  assert.equal(plan.focus, 'Finish and check the assignment');
  assert.match(plan.urgency, /finished, checked submission/);
});

test('study plan blocks add up exactly to the suggested time', () => {
  for (const confidence of [1, 2, 3, 4, 5]) {
    for (const days of [0, 1, 2, 4, 8, 14]) {
      const start = new Date(Date.UTC(2026, 10, 17 + days)).toISOString().slice(0, 10);
      const plan = studyPlan(priority(confidence, start));
      assert.equal(plan.activities.reduce((sum, activity) => sum + activity.minutes, 0), plan.totalMinutes);
      assert.ok(plan.activities.every(activity => activity.minutes >= 5));
    }
  }
});

test('break suggestion appears only on longer study plans', () => {
  assert.match(studyPlan(priority(1, '2026-11-18')).breakSuggestion, /break/);
  assert.equal(studyPlan(priority(5, '2026-12-01')).breakSuggestion, '');
});

test('lower confidence raises priority and nearer exam raises priority', () => {
  assert.ok(priority(1, '2026-11-20').score > priority(5, '2026-11-20').score);
  assert.ok(priority(3, '2026-11-18').score > priority(3, '2026-11-24').score);
});

test('missing and out-of-window events are handled safely', () => {
  assert.equal(studyPlan(null), null);
  assert.match(recommendationText(null), /Add a course/);
  assert.equal(studyPriorities([course(3)], [event('2026-12-03')], '2026-11-17').length, 0);
  assert.equal(daysUntil('2026-02-30', '2026-11-17'), null);
});

test('recommendation does not claim to create calendar events automatically', () => {
  assert.doesNotMatch(recommendationText(priority(2, '2026-11-18')), /added to (your )?calendar/i);
});
