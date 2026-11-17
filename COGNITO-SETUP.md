# StudyFlow v7: Complete AWS Cognito + Cloud Sync Setup (Windows / VS Code)

This guide is written for the StudyFlow project that was **already deployed to AWS Amplify Hosting**. The downloaded code is a full application implementation, not just snippets. AWS credentials and resources are **not** included. You must deploy its backend to your own AWS account before it can authenticate a real user.

**Contents:** secure sign-up, email verification, sign-in/out, password reset, a 10-character password policy enforced by AWS, a cloud data API with owner-protected Course/Event records, real-time updates between signed-in devices, and a manual import of previously saved v5 browser data.

## Before starting

- Install a supported Node.js version for Vite 7: **22.12+** (or 20.19+). Check with `node -v` and `npm -v`.
- Have access to the AWS account/Region used for your existing Amplify app, and the GitHub repo already connected to that app.
- Set a billing alert/budget in AWS Billing. Amplify Hosting, Cognito, AppSync, DynamoDB, and build resources may incur costs.
- **Back up your existing working repository** (or commit its current version) before merging this ZIP.
- Use **fake student data** until you have tested account isolation and security.

## Step 1 — Put the updated files in the existing repository

1. Extract `studyflow-cognito-cloud-sync.zip`.
2. In VS Code, open your **existing** Git repository directory, the one containing `.git`, `package.json`, and `src`.
3. Copy the contents of the extracted project **into** that directory. Review conflicts before overwriting custom work. **Do not replace or delete `.git`.** Do not copy `node_modules` from another machine.
4. If you already customized `amplify/backend.ts`, `amplify/auth/resource.ts`, or `amplify/data/resource.ts`, merge the resource definitions instead of overwriting changes blindly. This package assumes the v5/v6 baseline.
5. Confirm the root contains `amplify/`, `src/`, `package.json`, `amplify.yml`, and `index.html`.
6. **Do not run `npm create amplify@latest` again.** This ZIP already includes the Amplify Gen 2 backend files.

In the VS Code terminal (PowerShell or CMD), run:

```powershell
node -v
npm -v
npm install
npm test
```

`npm install` creates or refreshes `package-lock.json`. **Keep both `package.json` and `package-lock.json` together in Git.** The Amplify pipeline uses `npm ci`, which fails when those files disagree.

## Step 2 — Understand the AWS backend you are deploying

```text
Browser: React/Vite StudyFlow
   |                           | 
   | email, password, tokens   | owner-authorized CRUD + subscriptions
   v                           v
Amazon Cognito               AWS AppSync GraphQL API
  user pool                     |
                                v
                             DynamoDB
                            Course / Event
```

Backend files:

- `amplify/auth/resource.ts`: Cognito email/password sign-in and user attributes.
- `amplify/data/resource.ts`: Course and Event models, both using `allow.owner()` for per-user record authorization. Each record's `owner` field is protected from client updates.
- `amplify/backend.ts`: Defines both resources and overrides Cognito's password policy to **minimum 10 characters**, with no mandatory character-type rules.
- `src/lib/cloudPlannerCore.js`: handles cloud create, edit, delete, child-event deletion, and subscriptions. It also checks a linked course is accessible before saving an event.
- `src/components/Dashboard.jsx`: listens to cloud subscriptions instead of reading from localStorage. The course count labels recalculate from live event data.
- `src/components/AuthScreen.jsx`: real registration, email confirmation, sign-in, sign-out (through App), and password reset flows.

The browser **does not store account passwords**. Cognito manages user authentication. The app never embeds AWS IAM access keys into frontend source. The generated `amplify_outputs.json` is public app configuration, not your AWS secret keys.

## Step 3 — Configure local AWS credentials (to test before pushing)

If you already configured an AWS profile with permissions to deploy Amplify Gen 2, use it. Otherwise, follow the official AWS guide:

https://docs.amplify.aws/react/start/account-setup/

On Windows, install AWS CLI v2, then (after setting up IAM Identity Center or another approved method):

```powershell
aws configure sso
aws sso login --profile YOUR_PROFILE
aws sts get-caller-identity --profile YOUR_PROFILE
```

`YOUR_PROFILE` is the named AWS CLI profile you created. This is *not* your Cognito user login. Your AWS profile needs permissions to deploy the backend, often the managed policy `AmplifyBackendDeployFullAccess`. Do **not** put AWS secret access keys in `src` or commit `~/.aws/credentials`.

If you cannot get CLI credentials locally, you can skip to **Step 5: deploy with the existing Amplify hosting app**, then later retrieve the deployed `amplify_outputs.json` to test locally.

## Step 4 — Deploy your separate development backend (recommended)

In a terminal at the project root:

```powershell
npx ampx sandbox --profile YOUR_PROFILE
```

If your profile is `default`, you can use `npx ampx sandbox` without `--profile`.

- The first run may ask to bootstrap CDK in your AWS account/Region. Complete AWS's on-screen instructions if it does.
- The command deploys a **separate development Cognito user pool, AppSync API, and DynamoDB tables**, then writes `amplify_outputs.json` in the project root.
- Leave this terminal running while developing. The sandbox watches backend changes.
- The sandbox is not the production backend. **Sandbox users do not automatically exist in the production Cognito pool.**

In a **second VS Code terminal**, in the same project root:

```powershell
npm run dev
```

Open the Vite local URL. You should see StudyFlow's login page. Sign up using an email address you own (and a password with at least 10 characters), check your inbox for the Cognito code, verify it, and sign in. Create a course and an exam. Open a separate private browser window, sign in to the **same** account, and confirm the records appear. Changes should propagate while both windows are online.

You may also test a production build **after** `amplify_outputs.json` has been generated:

```powershell
npm run build
```

If you see `Cannot resolve amplify_outputs.json`, you tried to build the frontend before generating the config. Run the sandbox or `npx ampx generate outputs` against an already deployed backend.

## Step 5 — Enable backend deployment in your existing AWS Amplify app

You already have a React website at an `amplifyapp.com` URL. You can keep that app and the same GitHub branch.

1. Go to the [AWS Amplify Console](https://console.aws.amazon.com/amplify/home).
2. Open your existing StudyFlow/StudyPlanner app and note which GitHub **branch** is connected (for example `main`).
3. Verify the app has a **service role capable of backend deployment**. For an existing app, AWS documents **App settings → IAM roles → Service role → Edit**. Choose or create the appropriate **Amplify - Backend Deployment** role. See https://docs.aws.amazon.com/amplify/latest/userguide/amplify-service-role.html .
4. Open **Hosting / Build settings** in Amplify and confirm the build is using the committed `amplify.yml` from your repository (or paste the equivalent into the console if it overrides the repository buildspec). Ensure it deploys both backend and frontend:

```yaml
version: 1
backend:
  phases:
    build:
      commands:
        - npm ci
        - npx ampx pipeline-deploy --branch $AWS_BRANCH --app-id $AWS_APP_ID
frontend:
  phases:
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: dist
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
```

The backend phase provisions/updates your branch's AWS resources and generates **that branch's** `amplify_outputs.json`. The frontend phase builds the app with the correct backend config. **Do not commit a sandbox `amplify_outputs.json`.**

5. In the root of your existing Git repository, confirm you've installed dependencies and created the lockfile:

```powershell
npm install
npm test
git status
git add .
git commit -m "Add Cognito and cloud-synced courses and events"
git branch --show-current
git push origin main
```

Replace `main` in the last command with the branch you actually use.

6. Watch the Amplify build logs. The **backend** step must succeed, *then* the **frontend** step must succeed. Visit your existing Amplify URL once deployment finishes.

**If the backend fails with `AccessDenied`:** verify the Amplify app's service role, not just your local AWS CLI profile.

**If `npm ci` fails with a package lock mismatch:** run `npm install` locally, review and commit the regenerated `package-lock.json`, then push again. Do not blindly use `--legacy-peer-deps` or force push.

**If Vite complains about Node:** select a supported Node.js version in your Amplify build environment; Vite 7 needs Node 20.19+ or 22.12+.

## Step 6 — Local development against your deployed (not sandbox) branch

You can generate the branch's app config without running a sandbox:

```powershell
npx ampx generate outputs --app-id YOUR_AMPLIFY_APP_ID --branch main --profile YOUR_PROFILE
npm run dev
```

`YOUR_AMPLIFY_APP_ID` is the identifier for your Amplify Hosting app (visible in the Amplify Console; do not use the full URL), and the branch must match the deployed branch. Running this overwrites the local `amplify_outputs.json` to point to your selected backend. **Be careful not to test against production when you intend to use a sandbox.**

## Step 7 — Verify cross-device login and data isolation

**Test A: same user on two devices**

1. On your computer, open the AWS-hosted URL and create a fresh Cognito account.
2. Enter the verification code from your email. Sign in.
3. Add a course: `CSCE 3444`, `Software Engineering`, `Section 201`, and choose a color.
4. Add `Project Proposal Due` as an Assignment for that course.
5. On your phone or a separate browser profile, open the **same deployed URL** and sign in using the same email/password.
6. Verify that the course, course color, event, calendar entry, and Assignment count all appear.
7. Edit the event on the phone. Verify the change appears on the computer (real-time subscription) or reconnect/refresh if its network was interrupted.
8. Delete the event and verify the Assignment count disappears from the course.

**Test B: separate users must not see each other's data**

1. Register a **different** email address as a second Cognito account.
2. Sign in as the second user and check that the first user's courses/events are **not** visible.
3. Try a create/edit/delete under each account independently.
4. For a deeper authorization check, use network/API tooling to confirm user B cannot read/update/delete a record belonging to user A. The front-end view alone does not prove server-side access control.

**Test C: sign-up, reset, and validation**

- Try a 9-character password: the form should reject it.
- Try 10 characters: Cognito policy should accept it if otherwise valid.
- Try `student@gnail`: the form should suggest `gmail.com`.
- Try a legitimate school email domain: it should not be blocked just because it is not Gmail.
- Confirm that signing in with an unverified account requires confirmation.
- Test **Forgot password?** and the confirmation email.

## Step 8 — Import older v5 browser-only courses and events (optional)

The v5 app stored courses/events under `localStorage` keys specific to your demo email. **They do not automatically appear in the new cloud database.** After signing into Cognito on the **same browser and website origin** used by v5, StudyFlow detects old data for your email and offers an **Import to Cloud** button.

- Clicking Import transfers course records **first**, then linked events, using their existing IDs.
- Records already present in the cloud with the same IDs are skipped; re-running an import after a partial failure is safe.
- A course event without its matching course is skipped and reported, rather than linking to another student's course.
- The old local records are **not deleted** by the importer.
- If you changed Amplify website address, browser localStorage belongs to the **old origin** and the new app cannot read it. Use the old site to export/re-enter data as appropriate; do not assume the records were migrated.
- These older demo accounts were never real Cognito users. Register a Cognito account using the correct email address.

## Common problems

| Symptom | Likely cause and next step |
|---|---|
| App shows a blank screen | Open browser Developer Tools Console. Confirm `amplify_outputs.json` was generated before the Vite build. |
| `Cannot resolve ../amplify_outputs.json` | Generate a sandbox/branch output file, then rebuild. |
| `No credentials` in CLI | Configure an AWS CLI profile and run `aws sts get-caller-identity --profile YOUR_PROFILE`. |
| Backend fails with AccessDenied | Add/choose the Amplify backend deployment service role in Amplify Console. |
| `npm ci` lockfile failure | Run `npm install` in the project root; commit the updated lockfile. |
| Signup fails due to password complexity | Ensure the **new** backend has deployed the Cognito override from `amplify/backend.ts`, and you're not targeting an old user pool. |
| Account created but no email | Verify the user pool and confirmation state, check spam, and check Cognito email sending limits/settings in AWS. |
| Phone login works, but no courses | Confirm **both** devices use the same URL/branch/environment and same Cognito account; check `AppSync` auth errors in the browser. |
| `Unauthorized` for cloud data | Confirm `amplify_outputs.json` points to the correct branch and sign in again; check AppSync owner authorization. |
| Sync never finishes | Check browser network/console for AppSync websocket/API errors and click Retry connection. |
| Course disappears after login | The cloud database starts empty; old local data needs an explicit import or re-entry. |
| `npx ampx sandbox` touches production? | It creates a separate dev backend; it does **not** migrate or write to the deployed branch unless you explicitly connect to that branch. |

## Important security and operational limits

- Cognito enforces account authentication, and AppSync owner rules enforce user-record isolation. However, this is **an implementation to deploy and validate**, not a claim that your AWS account is already configured or that security has been independently audited.
- This app checks that the chosen course is accessible to the logged-in user before creating/updating an event, but the **simple `courseId` field is not a database-enforced foreign key**. A more advanced service could enforce relationships server-side with a custom mutation.
- Automatic course color selection is based on the currently synced course list; simultaneous new-course creation on two devices may choose the same color.
- Real-time updates need an active network connection. This build does not offer offline writes, conflict resolution, MFA challenge screens, or guaranteed transactional cascade deletion across tables.
- Deleting a course removes associated events one at a time, then deletes the course. If an event deletion fails, the course is retained and an error is displayed. A larger system could use a transactional server-side workflow.
- Passwords require a minimum of 10 characters by user request. Stronger policies, optional MFA, rate limits, incident monitoring, backup/restore strategy, and a comprehensive accessibility review are recommended before handling real students' data.
- Cognito, DynamoDB, AppSync, and Amplify Hosting can generate charges. Review AWS Budgets and resource usage.

## Official AWS references

- Gen 2 manual install: https://docs.amplify.aws/react/start/manual-installation/
- Set up auth: https://docs.amplify.aws/react/build-a-backend/auth/set-up-auth/
- Password policy override: https://docs.amplify.aws/react/build-a-backend/auth/manage-users/manage-passwords/
- Define data: https://docs.amplify.aws/react/build-a-backend/data/set-up-data/
- Per-owner data access: https://docs.amplify.aws/react/build-a-backend/data/customize-authz/per-user-per-owner-data-access/
- Real-time subscriptions: https://docs.amplify.aws/react/frontend/data/subscribe-data/
- AWS service role for backend deployment: https://docs.aws.amazon.com/amplify/latest/userguide/amplify-service-role.html
- CLI `generate outputs`: https://docs.amplify.aws/react/reference/cli-commands/
