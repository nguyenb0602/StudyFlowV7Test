// Run from the StudyFlow repo root after copying this ZIP's contents into it.
// Only modifies specific insertion points; errors before writing if any are missing.
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';
const root = process.cwd();
const edits = new Map();
function load(path) {
  const full=join(root,path);
  if (!existsSync(full)) throw new Error(`Missing ${path}: run from your StudyFlow repository root.`);
  if (!edits.has(path)) edits.set(path,readFileSync(full,'utf8'));
  return edits.get(path);
}
function replace(path,needle,withText) {
  let old=load(path);
  if (old.includes(withText)) return;
  if (!old.includes(needle)) throw new Error(`Could not find expected code in ${path}. No files were changed.`);
  old=old.replace(needle,withText);
  edits.set(path,old);
}
// Dashboard navigation and section. No auth or existing schema is overwritten.
replace('src/components/Dashboard.jsx',"import CalendarView from './CalendarView.jsx';", "import CalendarView from './CalendarView.jsx';\nimport StudyAssistant from './StudyAssistant.jsx';");
replace('src/components/Dashboard.jsx',"['Dashboard', 'Courses', 'Events']", "['Dashboard', 'Courses', 'Events', 'Study Assistant']");
replace('src/components/Dashboard.jsx',"page === 'Events' ? 'Browse every event and choose how to sort it.' : 'Keep track of your courses and events.'", "page === 'Events' ? 'Browse every event and choose how to sort it.' : page === 'Study Assistant' ? 'Set your confidence and plan your study time.' : 'Keep track of your courses and events.'");
replace('src/components/Dashboard.jsx',"        ) : page === 'Events' ? (\n          <EventsSection events={events} courses={courses} onEventClick={openDetails} onEditEvent={editEvent} onDeleteEvent={deleteEvent} disabled={working} />\n        ) : (", "        ) : page === 'Events' ? (\n          <EventsSection events={events} courses={courses} onEventClick={openDetails} onEditEvent={editEvent} onDeleteEvent={deleteEvent} disabled={working} />\n        ) : page === 'Study Assistant' ? (\n          <StudyAssistant courses={courses} events={events} onSaveCourse={saveCourse} />\n        ) : (");
// Confidence sync (optional Course field). Form editing must retain the field.
replace('src/lib/cloudPlannerCore.js',"import { duplicateCourseMessage, findDuplicateCourse } from './courseIdentity.js';", "import { duplicateCourseMessage, findDuplicateCourse } from './courseIdentity.js';\nimport { confidenceValue } from './studyPriorities.js';");
replace('src/lib/cloudPlannerCore.js',"    colorSource: record.colorSource || 'automatic',", "    colorSource: record.colorSource || 'automatic',\n    confidence: confidenceValue(record.confidence),");
replace('src/lib/cloudPlannerCore.js',"        colorSource: course.colorSource,", "        colorSource: course.colorSource,\n        confidence: confidenceValue(course.confidence),");
replace('src/components/CourseForm.jsx',"      colorSource: form.pickColor ? 'custom' : 'automatic',", "      colorSource: form.pickColor ? 'custom' : 'automatic',\n      confidence: initialCourse?.confidence ?? 3,");
// Merge-only schema modifications, retain any manual ID/owner authorization fixes.
replace('amplify/data/resource.ts',"import { a, defineData, type ClientSchema } from '@aws-amplify/backend';", "import { a, defineData, type ClientSchema } from '@aws-amplify/backend';\nimport { studyCoach } from '../functions/study-coach/resource';");
replace('amplify/data/resource.ts',"    colorSource: a.string().required(),", "    colorSource: a.string().required(),\n    confidence: a.integer(),");
// Find the model schema closing instead of requiring exact whitespace before the Schema export.
// This works with blank lines, comments, CRLF, and manual ID/authorization changes.
function ensureStudyCoachQuery() {
  const path = 'amplify/data/resource.ts';
  let content = load(path);
  if (/\baskStudyCoach\s*:\s*a\.query\s*\(/.test(content)) return;
  const schemaStart = content.search(/\bconst\s+schema\s*=\s*a\.schema\s*\(\s*\{/);
  const schemaExport = content.search(/\bexport\s+type\s+Schema\s*=\s*ClientSchema\s*</);
  if (schemaStart < 0 || schemaExport < schemaStart) {
    throw new Error(`Cannot locate the Amplify schema in ${path}. No files were changed. Please inspect the file manually.`);
  }
  const schemaClose = content.lastIndexOf('});', schemaExport);
  if (schemaClose < schemaStart) {
    throw new Error(`Cannot locate the end of the Amplify schema in ${path}. No files were changed.`);
  }
  const query = `  askStudyCoach: a.query()
    .arguments({ message: a.string().required(), context: a.string().required() })
    .returns(a.string())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(studyCoach)),
`;
  content = content.slice(0, schemaClose) + query + content.slice(schemaClose);
  edits.set(path, content);
}
ensureStudyCoachQuery();
// Amplify's generated type-safe Lambda environment import needs this path mapping.
const tsPath = 'amplify/tsconfig.json';
const ts = JSON.parse(load(tsPath));
ts.compilerOptions = ts.compilerOptions || {};
ts.compilerOptions.paths = {...(ts.compilerOptions.paths || {}), '$amplify/*': ['../.amplify/generated/*']};
edits.set(tsPath, JSON.stringify(ts, null, 2) + '\n');
// Only modify CSS when feature styles are not already included.
const css = load('src/styles.css');
if (!css.includes('.study-section {')) edits.set('src/styles.css', css + '\n' + readFileSync(join(root,'PLANNING-STYLES.css'),'utf8'));
for (const [path,contents] of edits) writeFileSync(join(root,path),contents);
console.log(`StudyFlow v9 (fixed installer) applied to ${edits.size} files. Review git diff, run npm test, and configure your AI secret before deployment.`);
