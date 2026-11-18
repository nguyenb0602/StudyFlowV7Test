// Framework-neutral, deterministic recommendations. This part uses no AI API.
const EVENT_WEIGHT = { Exam: 30, Assignment: 23, 'Study Session': 12, Meeting: 4, Other: 7 };

export function confidenceValue(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 5 ? number : 3;
}

export function daysUntil(date, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return null;
  const parse = (value) => {
    const [y,m,d] = value.split('-').map(Number);
    const ms = Date.UTC(y,m - 1,d);
    const actual = new Date(ms);
    return actual.getUTCFullYear() === y && actual.getUTCMonth() === m - 1 && actual.getUTCDate() === d ? ms : null;
  };
  const a = parse(date), b = parse(today);
  return a === null || b === null ? null : Math.round((a-b)/86400000);
}

export function studyPriorities(courses, events, today, limit = 6) {
  const courseById = new Map(courses.map(c => [c.id,c]));
  return events.flatMap(event => {
    if (!event.courseId || !courseById.has(event.courseId)) return [];
    const days = daysUntil(event.date, today);
    if (days === null || days < 0 || days > 14) return [];
    const course = courseById.get(event.courseId);
    const confidence = confidenceValue(course.confidence);
    const urgency = 35 - days * 2.2;
    const score = Math.round(urgency + (6-confidence) * 9 + (EVENT_WEIGHT[event.type] || 7));
    return [{ event, course, confidence, days, score }];
  }).sort((a,b) => b.score - a.score || a.days - b.days || a.event.title.localeCompare(b.event.title))
    .slice(0, Math.max(0, Math.min(20, limit)));
}

export function recommendationText(priority) {
  if (!priority) return 'Add a course and an upcoming event to get a personalized recommendation.';
  const {course,event,days,confidence} = priority;
  const deadline = days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
  return `Focus on ${course.department} ${course.code} (${course.name}). You rated your confidence ${confidence}/5, and your ${event.type.toLowerCase()} “${event.title}” is ${deadline}. Try one 30–45 minute review block, take a short break, then practice recalling or applying the material.`;
}

export function aiContext(courses, events, today) {
  return JSON.stringify({
    today,
    courses: courses.slice(0, 35).map(c => ({code: `${c.department} ${c.code}`,name: c.name,confidence: confidenceValue(c.confidence)})),
    upcomingEvents: events.filter(e => { const d = daysUntil(e.date,today); return d !== null && d >= 0 && d <= 30; })
      .sort((a,b) => a.date.localeCompare(b.date)).slice(0, 50).map(e => ({ title: e.title, type:e.type, date:e.date, course: (courses.find(c=>c.id===e.courseId) || {}).name || 'General' }))
  });
}
