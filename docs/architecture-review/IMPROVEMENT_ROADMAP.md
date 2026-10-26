# Varlikent Improvement Roadmap

Companion to `ARCHITECTURE_REVIEW.md`. Finding numbers (F1, F2, ...) refer to section 9 of that file, where the evidence is.

**Nothing here has been implemented.** This is a proposal to discuss.

## How the order was chosen

1. Security problems that an outsider can reach come first.
2. Then changes that are small and make later work safer.
3. Then structure, which costs more and pays back slowly.
4. Scaling work comes last, because the current size does not need it yet.

Each item says what "done" means, so it can be checked.

## Phase 0 — Check before changing anything

| # | Check | Why |
|---|---|---|
| 0.1 | In the Azure portal, open the Varlikent app registration and read "Supported account types" | Decides whether F1 is exploitable today. Multi-tenant means fix it immediately. |
| 0.2 | Confirm on Render that `FRONTEND_URL` and `MICROSOFT_CLIENT_ID` are set | F4 falls back to a wildcard origin without the first; Microsoft login returns 500 without the second |
| 0.3 | Decide how the diagrams will be rendered | See section 12 of the review |

## Phase 1 — Close the open doors

Small changes, low risk, high value. Backend only; no client release needed.

| # | Change | Finding | Priority | Risk | Done when |
|---|---|---|---|---|---|
| 1.1 | Identify Microsoft users by tenant id + object id stored in `User.microsoftId`; stop auto-linking by `preferred_username`; cut clock tolerance to minutes | F1 | Critical | Medium | A token from another tenant with a matching username gets a new account, never an existing one |
| 1.2 | Add rate limits: strict on `/api/auth/*`, moderate on `/api/chat`, `/api/contact`, `/api/translate`, `/api/push/devices/anonymous` | F2 | High | Low | Repeated requests receive 429 |
| 1.3 | Cap `texts` length and size in `/api/translate`; bound the cache | F3 | High | Low | A 10,000-item request is rejected; memory stays flat |
| 1.4 | Give `cors()` the same `isAllowedOrigin` check Socket.IO uses | F4 | Medium | Low | REST and sockets accept exactly the same origins |
| 1.5 | Add basic security headers | F2 | Medium | Low | Responses carry the standard hardening headers |

Item 1.2 and 1.5 need new packages (a rate limiter and a headers middleware). That is a dependency decision for you.

## Phase 2 — Make authorization and errors predictable

| # | Change | Finding | Priority | Risk | Done when |
|---|---|---|---|---|---|
| 2.1 | Write one table: route, required role, required permission. Keep it in the repo | F6 | Medium | Low | Every `/api` route appears once |
| 2.2 | Make routes match the table: add `requireRole` to `PATCH /contact/:id/status`; add a permission to upload and delete | F6 | Medium | Low | No route relies on a role alone where its neighbours need a permission |
| 2.3 | Replace the three custom guards in `routes/users.js` with `requirePermission` | F6 | Low | Low | One guard implementation remains |
| 2.4 | Align the website with the API: let `user_management` holders reach `/admin/users`, or remove that permission | F6 | Low | Low | UI and API agree |
| 2.5 | One error type with a status code; map bad ObjectIds to 404; stop returning `err.message` for 500s | F11 | Medium | Low | A malformed id returns 404; a crash returns a generic message |
| 2.6 | Add `tokenVersion` to User, check it in `userFromToken`, bump it on password change | F7 | Medium | Medium | Changing a password signs out other devices |
| 2.7 | Add one axios response interceptor that clears the session on 401 | F7 | Medium | Low | An expired token always lands on the login page |
| 2.8 | Remove message text from chatbot logs | F15 | Low | Low | Logs contain ids and decisions only |

## Phase 3 — Reduce the size of the hardest files

Do these one at a time, each behind the existing tests.

| # | Change | Finding | Priority | Risk | Done when |
|---|---|---|---|---|---|
| 3.1 | In `routes/chat.js`, extract one `respond()` helper that saves the exchange and sends the JSON | F5 | Medium | Medium | `recordChatExchange` is called from one place |
| 3.2 | Split the chat handler into named steps (gate, parse, early answers, search, reply) in separate functions | F5 | Medium | Medium | The route function reads as a short list of steps |
| 3.3 | Move parsing and validation helpers out of `routes/properties.js` into a service module | F5 | Medium | Medium | The route file contains routes only |
| 3.4 | Remove the duplicate fallback step in `searchWithFallback`, and `/properties/sale` and `/rent` if no client uses them | F5 | Low | Low | No two code paths build the same query |
| 3.5 | Share one `uploadToCloudinary` helper | F5 | Low | Low | One definition |
| 3.6 | Delete the 19 unimported frontend files and `AdminAuthContext.jsx` after one search each | F14 | Low | Low | The build output and tests are unchanged |
| 3.7 | Fix `.env.example` (`MICROSOFT_CLIENT_ID`, `GEMINI_API_KEY`) and rename the frontend package | F14 | Low | Low | A fresh clone can be configured from the example file alone |
| 3.8 | Website: add a thin API module per feature (properties, users, cms) so pages stop calling axios directly. Start with one feature | F5 | Medium | Medium | New pages import functions, not the axios instance |

For 3.8 the mobile app already shows the target shape: `src/features/<feature>/<feature>-api.ts`.

## Phase 4 — Prepare for growth

Only when the numbers call for it.

| # | Change | Finding | Trigger | Risk |
|---|---|---|---|---|
| 4.1 | Optional `page` and `limit` on `GET /api/properties`, then adopt in both clients | F8 | A few hundred listings | Medium |
| 4.2 | Indexes for the common listing filter | F8 | Slow list queries in Atlas | Low |
| 4.3 | Upload from the browser straight to Cloudinary with a signed request | F10 | Video uploads in regular use | Medium |
| 4.4 | Atlas Vector Search instead of in-memory cosine | F9 | Low thousands of listings | Medium |
| 4.5 | Socket.IO adapter, and move the image worker to its own process | F12 | Before running a second backend instance | Medium |
| 4.6 | A shared package for the logic duplicated between website and app | F13 | When a parity bug costs real time | Medium |

## What I would do first

If only one week were available: Phase 0, then 1.1 to 1.4, then 2.5 and 3.1. That closes the reachable security issues and removes the most repeated code, with no client release and little risk.

## What I would not change

- REST as the only write path, with sockets as notifications only.
- Gemini limited to parsing and embedding, with template replies.
- The Google sign-in verification in `services/googleAuth.js`.
- The MongoDB-leased image worker.
- The mobile app's feature folder structure.

These are the best-designed parts of the system.
