# StudyFlow: Cognito + AWS Cloud Sync

This is the **actual full-stack replacement** of the earlier StudyPlanner v5/v6 React demo. The UI retains course management, course colors, a month/week/day calendar, collapsible upcoming events, sorted Events tab, add/edit/delete, and per-course event-type counts.

**The difference:** registration and login use **AWS Cognito**, and course/event records use **Amplify Gen 2 Data (AppSync + DynamoDB)** with **per-owner authorization**. Two logged-in browsers can receive live updates via `observeQuery` subscriptions. The frontend no longer saves newly created courses or events to browser `localStorage`.

> **Start here: [COGNITO-SETUP.md](COGNITO-SETUP.md)**. It explains every step for Windows, VS Code, AWS credentials, sandbox testing, your existing Amplify Hosting app, GitHub deployment, migration, and troubleshooting.

## Quick command summary

```powershell
npm install
npm test
# AWS CLI profile and permissions required for the next command:
npx ampx sandbox --profile YOUR_PROFILE
# In a second terminal:
npm run dev
npm run build
```

For deployment, generate/commit `package-lock.json`, then push source to the GitHub branch connected to Amplify Hosting. `amplify.yml` deploys the backend before building the frontend.

## Important source files

```text
amplify/auth/resource.ts          Cognito email sign-in
amplify/data/resource.ts          Course/Event models, owner rules
amplify/backend.ts                Backend setup and 10-char password policy
src/main.jsx                     Amplify.configure(outputs)
src/App.jsx                      Session restore and sign-out
src/components/AuthScreen.jsx     Sign-up/confirm/sign-in/reset UI
src/components/Dashboard.jsx      Real-time cloud subscriptions and CRUD actions
src/lib/cloudPlanner.js           Lazily creates the Cognito-authorized Data client
src/lib/cloudPlannerCore.js       Tested repository operations
src/lib/legacyImport.js           Optional manual v5 localStorage import
src/lib/storage.js                Legacy v5 storage functions (only read by the new app)
src/components/CalendarView.jsx   Existing month/week/day calendar
src/components/EventsSection.jsx  Event list and sorting
amplify.yml                        GitHub-backed backend + frontend deployment
```

**Nothing has been deployed to your AWS account by the creation of this ZIP.** AWS credentials, branch configuration, a backend deployment, and device-level testing are still required. Because this environment cannot reach the npm registry or your AWS account, the production build and actual Cognito/AppSync integration must be verified on your machine.
