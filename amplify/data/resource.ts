import { a, defineData, type ClientSchema } from '@aws-amplify/backend';

const schema = a.schema({
  Course: a.model({
    name: a.string().required(),
    department: a.string().required(),
    code: a.string().required(),
    section: a.string().required(),
    professor: a.string().required(),
    color: a.string().required(),
    colorSource: a.string().required(),
    owner: a.string().authorization(allow => [allow.owner().to(['read', 'delete'])]),
  }).authorization(allow => [allow.owner()]),

  Event: a.model({
    title: a.string().required(),
    type: a.string().required(),
    date: a.date().required(),
    // HH:mm, matching the existing <input type="time"> fields.
    time: a.string().required(),
    // Keep this optional for general events. The frontend verifies that a
    // chosen course is accessible to the current user before creating an event.
    courseId: a.id(),
    owner: a.string().authorization(allow => [allow.owner().to(['read', 'delete'])]),
  }).authorization(allow => [allow.owner()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: { defaultAuthorizationMode: 'userPool' },
});
