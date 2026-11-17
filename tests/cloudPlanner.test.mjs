import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlannerRepository, mapCourse, mapEvent } from '../src/lib/cloudPlannerCore.js';

function setup() {
  const calls = [];
  const courses = new Map();
  const events = new Map();
  const Course = {
    async create(item) { calls.push(['createCourse', item]); courses.set(item.id, item); return { data: item }; },
    async update(item) { calls.push(['updateCourse', item]); courses.set(item.id, item); return { data: item }; },
    async get({ id }) { calls.push(['getCourse', id]); return { data: courses.get(id) || null }; },
    async delete({ id }) { calls.push(['deleteCourse', id]); const data = courses.get(id); courses.delete(id); return { data }; },
    observeQuery() { return { subscribe({ next }) { next({ items: [...courses.values()], isSynced: true }); return { unsubscribe() { calls.push(['unsubscribeCourse']); } }; } }; },
  };
  const Event = {
    async create(item) { calls.push(['createEvent', item]); events.set(item.id, item); return { data: item }; },
    async update(item) { calls.push(['updateEvent', item]); events.set(item.id, item); return { data: item }; },
    async delete({ id }) { calls.push(['deleteEvent', id]); const data = events.get(id); events.delete(id); return { data }; },
    async list({ filter, nextToken }) {
      calls.push(['listEvents', filter.courseId.eq, nextToken || null]);
      return { data: [...events.values()].filter(event => event.courseId === filter.courseId.eq), nextToken: null };
    },
    observeQuery() { return { subscribe({ next }) { next({ items: [...events.values()], isSynced: true }); return { unsubscribe() { calls.push(['unsubscribeEvent']); } }; } }; },
  };
  return { repo: createPlannerRepository({ Course, Event }), calls, courses, events, Course, Event };
}

const course = {
  id: 'c1', name: 'Software Engineering', department: 'CSCE', code: '3444',
  section: '201', professor: 'Dr Smith', color: '#2563eb', colorSource: 'automatic',
};
const event = { id: 'e1', title: 'Quiz', type: 'Exam', date: '2026-11-30', time: '09:00', courseId: 'c1' };

test('data mapping handles nullable course association for general events', () => {
  assert.equal(mapEvent({ ...event, courseId: null }).courseId, '');
  assert.equal(mapCourse({ id: 'c1', name: 'Math' }).colorSource, 'automatic');
});

test('course creation and editing use cloud create/update, preserving IDs', async () => {
  const { repo, calls } = setup();
  await repo.saveCourse(course, false);
  const updated = await repo.saveCourse({ ...course, name: 'Engineering II' }, true);
  assert.equal(updated.id, 'c1');
  assert.equal(updated.name, 'Engineering II');
  assert.deepEqual(calls.map(x => x[0]), ['createCourse', 'updateCourse']);
});

test('event creation verifies that linked course is accessible before writing', async () => {
  const { repo, calls } = setup();
  await repo.saveCourse(course, false);
  const result = await repo.saveEvent(event, false);
  assert.equal(result.courseId, 'c1');
  assert.deepEqual(calls.slice(-2).map(x => x[0]), ['getCourse', 'createEvent']);
});

test('event creation rejects unknown or inaccessible course IDs', async () => {
  const { repo, calls } = setup();
  await assert.rejects(() => repo.saveEvent(event, false), /unavailable/);
  assert.equal(calls.some(x => x[0] === 'createEvent'), false);
});

test('general events store null courseId and can be edited', async () => {
  const { repo, calls } = setup();
  await repo.saveEvent({ ...event, courseId: '' }, false);
  await repo.saveEvent({ ...event, title: 'Quiz updated', courseId: '' }, true);
  assert.equal(calls[0][1].courseId, null);
  assert.equal(calls[1][0], 'updateEvent');
});

test('event deletion operates on remote model', async () => {
  const { repo, events, calls } = setup();
  events.set('e1', event);
  await repo.deleteEvent('e1');
  assert.equal(events.size, 0);
  assert.deepEqual(calls[0], ['deleteEvent', 'e1']);
});

test('course deletion removes linked events before deleting course', async () => {
  const { repo, courses, events, calls } = setup();
  courses.set('c1', course);
  events.set('e1', event);
  events.set('e2', { ...event, id: 'e2' });
  events.set('other', { ...event, id: 'other', courseId: '' });
  await repo.deleteCourse('c1');
  assert.deepEqual(calls.map(x => x[0]), ['listEvents','deleteEvent','deleteEvent','deleteCourse']);
  assert.equal(courses.size, 0);
  assert.equal(events.size, 1);
});

test('a failed linked-event deletion preserves the course for a retry', async () => {
  const { repo, Course, Event } = setup();
  const calls = [];
  Course.delete = async () => { calls.push('deletedCourse'); return { data: course }; };
  Event.list = async () => ({ data: [event], nextToken: null });
  Event.delete = async () => ({ errors: [{ message: 'Permission denied' }], data: null });
  await assert.rejects(() => repo.deleteCourse('c1'), /Permission denied/);
  assert.deepEqual(calls, []);
});

test('subscriptions receive remote snapshots and clean up on unmount', () => {
  const { repo, courses, events, calls } = setup();
  courses.set('c1', course);
  events.set('e1', event);
  let receivedCourses;
  let receivedEvents;
  const stop = repo.subscribe({
    onCourses: (items, synced) => { receivedCourses = [items, synced]; },
    onEvents: (items, synced) => { receivedEvents = [items, synced]; },
    onError: error => { throw error; },
  });
  assert.equal(receivedCourses[0][0].name, 'Software Engineering');
  assert.equal(receivedEvents[0][0].title, 'Quiz');
  assert.equal(receivedCourses[1], true);
  assert.equal(receivedEvents[1], true);
  stop();
  assert.ok(calls.some(x => x[0] === 'unsubscribeCourse'));
  assert.ok(calls.some(x => x[0] === 'unsubscribeEvent'));
});

import { importLegacyPlannerData } from '../src/lib/legacyImport.js';

test('old local-only records import into cloud with stable IDs and no duplicates', async () => {
  const { repo, courses, events } = setup();
  const legacy = { courses: [course], events: [event] };
  const first = await importLegacyPlannerData({ legacy, courses: [], events: [], repository: repo });
  assert.deepEqual(first, { importedCourses: 1, importedEvents: 1, skippedEvents: 0 });
  const second = await importLegacyPlannerData({ legacy, courses: [...courses.values()], events: [...events.values()], repository: repo });
  assert.deepEqual(second, { importedCourses: 0, importedEvents: 0, skippedEvents: 0 });
  assert.equal(courses.size, 1);
  assert.equal(events.size, 1);
});

test('old events referencing missing courses are not imported', async () => {
  const { repo, events } = setup();
  const result = await importLegacyPlannerData({
    legacy: { courses: [], events: [event] },
    courses: [], events: [], repository: repo,
  });
  assert.equal(result.skippedEvents, 1);
  assert.equal(events.size, 0);
});
