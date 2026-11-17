import { generateClient } from 'aws-amplify/data';
import { createPlannerRepository } from './cloudPlannerCore.js';

// Generate the API client only AFTER main.jsx calls Amplify.configure(outputs).
// ES module imports are evaluated before main.jsx's code runs, so creating
// the client at module scope could access Amplify before it is configured.
let repository;
export function getPlannerRepository() {
  if (!repository) {
    const client = generateClient({ authMode: 'userPool' });
    repository = createPlannerRepository(client.models);
  }
  return repository;
}
