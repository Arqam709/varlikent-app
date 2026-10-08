// Product flows after the information-architecture cleanup.
//
//   ACCOUNT   = what I saved, created or submitted (history)
//   SERVICES  = what I can start doing (tools)
//   DESIGN / PLAN  ≠  SEND A REQUEST
//
// These tests pin those rules: Account's single entry per concept, no dead
// routes, the tools that file nothing, the one screen that files a request,
// the renovation plan model, and My Designs' board + visualization grouping.
//
// Pure: source is read or transpiled; nothing renders and nothing is sent.

import test, { before } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP_DIR = path.join(ROOT, 'src', 'app')
const BACKEND_VALIDATION = path.resolve(ROOT, '..', 'varlikent', 'backend', 'services', 'serviceRequests', 'validation.js')

const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8')

const load = (relative, imports = {}) => {
  const { outputText } = ts.transpileModule(read(relative), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  const module = { exports: {} }
  const require = (id) => {
    if (id in imports) return imports[id]
    throw new Error(`${relative} imported an unexpected module: ${id}`)
  }
  new Function('exports', 'module', 'require', outputText)(module.exports, module, require)
  return module.exports
}

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]
  )

const SOURCE_FILES = walk(path.join(ROOT, 'src')).filter((file) => /\.(ts|tsx)$/.test(file))

let request
let plan
let history

before(() => {
  request = load('src/features/service-requests/service-request.ts')
  plan = load('src/features/renovation-plan/renovation-plan.ts', {
    '@/features/service-requests/service-request': request,
  })
  history = load('src/features/design-my-space/design-history.ts')
})

// ── Account ──────────────────────────────────────────────────────────────

test('Account lists each thing once: Favourites, Alerts, New Listings, Designs, Requests', () => {
  const account = read('src/app/(tabs)/account.tsx')
  // The signed-in screen's section (the signed-out view has a Preferences section of its own).
  const start = account.indexOf("title={t('account.sectionActivity')}")
  const section = account.slice(start, account.indexOf("title={t('account.sectionPreferences')}", start))

  const destinations = [...section.matchAll(/router\.push\('([^']+)'\)/g)].map((match) => match[1])
  assert.deepEqual(destinations, ['/favourites', '/notifications/alerts', '/notifications', '/designs', '/requests'])

  // Nothing else in Account opens any of these a second time…
  for (const destination of destinations) {
    assert.equal(account.split(`router.push('${destination}')`).length - 1, 1, `${destination} appears twice`)
  }
  // …and there is no umbrella dashboard, and no way to START a request here.
  assert.equal(/my-varlikent|myVarlikent|service-request/.test(account), false)
})

test('My Varlikent is gone: no screen, no route, no translation', () => {
  assert.equal(fs.existsSync(path.join(APP_DIR, 'my-varlikent')), false)
  for (const file of SOURCE_FILES) {
    const source = fs.readFileSync(file, 'utf8')
    assert.equal(/my-varlikent|myVarlikent|Saved Properties/.test(source), false, `${path.relative(ROOT, file)} still refers to it`)
  }
})

// ── Every link lands somewhere ───────────────────────────────────────────

/** The URL paths this Expo Router app serves, from its files. */
const ROUTES = (() => {
  const routes = new Set()
  for (const file of walk(APP_DIR)) {
    if (!/\.tsx$/.test(file) || path.basename(file).startsWith('_')) continue
    const route = '/' + path.relative(APP_DIR, file)
      .replace(/\\/g, '/')
      .replace(/\.tsx$/, '')
      .split('/')
      .filter((segment) => !/^\(.*\)$/.test(segment))
      .join('/')
    routes.add(route.replace(/\/index$/, '') || '/')
  }
  return routes
})()

test('no push, replace or dismiss points at a route that does not exist', () => {
  const linked = new Set()
  for (const file of SOURCE_FILES) {
    const source = fs.readFileSync(file, 'utf8')
    for (const match of source.matchAll(/(?:router\.(?:push|replace|dismissTo)\(|pathname:\s*)['"](\/[^'"?#]*)['"]/g)) {
      linked.add(match[1])
    }
  }
  assert.ok(linked.size > 20, 'the scan found too few links to be trustworthy')
  // A concrete link such as /services/renovation is served by /services/[service].
  const patterns = [...ROUTES].map((route) => new RegExp(`^${route.replace(/\[[^\]]+\]/g, '[^/]+')}$`))
  for (const target of linked) {
    assert.ok(patterns.some((pattern) => pattern.test(target)), `${target} is linked but no screen serves it`)
  }
  for (const route of ['/designs', '/requests', '/requests/[id]', '/renovation-planner', '/service-request']) {
    assert.ok(ROUTES.has(route), `${route} has no screen`)
  }
})

// ── Services start tools; tools file nothing ─────────────────────────────

test('only the request stage can file a request', () => {
  const submitters = SOURCE_FILES.filter((file) => fs.readFileSync(file, 'utf8').includes('submitServiceRequest('))
    .map((file) => path.relative(ROOT, file).replace(/\\/g, '/'))
    .sort()
  assert.deepEqual(submitters, [
    'src/app/service-request.tsx',
    'src/features/service-requests/service-request-api.ts',
  ])
})

test('the renovation planner plans; it never contacts Varlikent', () => {
  const planner = read('src/app/renovation-planner.tsx')
  for (const forbidden of ['service-request-api', 'submitServiceRequest', 'contact-api', 'sendContactEnquiry', 'apiRequest']) {
    assert.equal(planner.includes(forbidden), false, `the planner reaches ${forbidden}`)
  }
  // Its ONE way onward to Varlikent is the explicit request button.
  assert.equal((planner.match(/'\/service-request'/g) ?? []).length, 1)
  assert.ok(planner.includes("label={t('renovationPlanner.request')}"))
})

test('service pages open their tools, never a request form', () => {
  const screen = read('src/app/services/[service].tsx')
  assert.equal(screen.includes('/service-request'), false)
  assert.ok(screen.includes("router.push('/design-my-space')"))
  assert.ok(screen.includes("router.push('/renovation-planner')"))
})

test('My Requests is history: no way to start a request from it', () => {
  for (const file of ['src/app/requests/index.tsx', 'src/app/requests/[id].tsx']) {
    assert.equal(/['"]\/service-request['"]/.test(read(file)), false, `${file} starts a request`)
  }
})

test('Interior Design requests always come from a design', () => {
  const stage = read('src/app/service-request.tsx')
  assert.ok(stage.includes("if (type === 'interior_design' && !boardId && !generationId)"))
  assert.ok(stage.includes('<NeedsDesign'))
})

// ── The renovation plan ──────────────────────────────────────────────────

const completePlan = (extra = {}) => ({
  ...plan.emptyRenovationPlan(new Date('2026-09-28T10:00:00Z')),
  propertyType: 'apartment',
  sizeSqm: '120',
  areas: ['kitchen', 'bathroom'],
  work: ['flooring', 'plumbing', 'kitchen_bathroom'],
  budget: '500k_1m',
  timeline: 'within_3_months',
  photos: [{ uri: 'file:///cache/a.jpg', width: 1600, height: 1200 }],
  ...extra,
})

test('a plan is complete only when every planning question is answered', () => {
  assert.deepEqual([...plan.RENOVATION_PLAN_STEPS], ['property', 'areas', 'work', 'budget', 'photos', 'summary'])
  assert.equal(plan.firstIncompletePlanStep(plan.emptyRenovationPlan()), 'property')
  assert.equal(plan.firstIncompletePlanStep(completePlan({ areas: [] })), 'areas')
  assert.equal(plan.firstIncompletePlanStep(completePlan({ work: [] })), 'work')
  assert.equal(plan.firstIncompletePlanStep(completePlan({ timeline: null })), 'budget')
  assert.equal(plan.isRenovationPlanComplete(completePlan()), true)
})

test('photos never block a plan, and contact details are never part of one', () => {
  assert.equal(plan.isRenovationPlanComplete(completePlan({ photos: [] })), true)
  const keys = Object.keys(plan.emptyRenovationPlan())
  for (const contact of ['name', 'email', 'phone']) assert.equal(keys.includes(contact), false)
})

test('a stored plan is read defensively, never crashing the planner', () => {
  assert.equal(plan.renovationPlanFromStorage(null), null)
  assert.equal(plan.renovationPlanFromStorage('text'), null)
  const restored = plan.renovationPlanFromStorage({
    propertyType: 'villa',
    areas: ['kitchen', 'kitchen', 7],
    photos: [{ uri: 'file:///x.jpg', width: 10, height: 20 }, { uri: 'https://evil.test/x.jpg' }, 'junk'],
    updatedAt: 'not a date',
  })
  assert.deepEqual(restored.areas, ['kitchen'])
  assert.deepEqual(restored.photos.map((p) => p.uri), ['file:///x.jpg'])
  assert.equal(restored.budget, null)
  assert.equal(restored.updatedAt, new Date(0).toISOString())
})

test('an unanswered plan offers nothing to resume', () => {
  assert.equal(plan.hasPlanContent(plan.emptyRenovationPlan()), false)
  assert.equal(plan.hasPlanContent({ ...plan.emptyRenovationPlan(), district: 'Kadıköy' }), true)
})

test('a finished plan plus contact details is exactly the renovation request payload', async (t) => {
  const form = plan.planAsRequestForm(completePlan(), { name: 'Ahsan', email: 'a@example.com', phone: '+90 555 123 4567' })
  assert.equal(request.firstInvalidStep(form), null)
  const payload = request.buildServiceRequestPayload(form, 'sr-plan-12345678')
  assert.deepEqual(payload.renovation, { areas: ['kitchen', 'bathroom'], work: ['flooring', 'plumbing', 'kitchen_bathroom'] })
  assert.deepEqual(payload.property, { type: 'apartment', sizeSqm: 120 })

  // …and the backend's own validator accepts it.
  if (!fs.existsSync(BACKEND_VALIDATION)) {
    t.skip('backend repository not checked out beside the app')
    return
  }
  const { validateServiceRequestPayload } = await import(pathToFileURL(BACKEND_VALIDATION).href)
  assert.deepEqual(validateServiceRequestPayload(payload).errors, [])
})

test('an incomplete plan cannot reach the request: the missing step is a planning step', () => {
  const form = plan.planAsRequestForm(completePlan({ work: [] }), { name: 'A', email: 'a@example.com', phone: '5551234567' })
  const missing = request.firstInvalidStep(form)
  assert.equal(missing, 'work')
  // …which is not a step of the request stage, so the stage sends the customer to the planner.
  assert.equal(request.SERVICE_REQUEST_STEPS.renovation.includes(missing), false)
})

// ── My Designs: a board with its visualizations ──────────────────────────

const board = (id, extra = {}) => ({ id, room: 'living-room', style: 'warm', updatedAt: '2026-09-20T00:00:00Z', ...extra })
const gen = (id, boardId, status = 'succeeded', createdAt = '2026-09-21T00:00:00Z', hasResult = status === 'succeeded') => ({
  id,
  boardId,
  status,
  hasResult,
  createdAt,
})

test('each board appears once, whatever its visualizations', () => {
  const entries = history.groupDesignHistory(
    [board('b1'), board('b2'), board('b3')],
    [gen('g1', 'b2'), gen('g2', 'b3', 'succeeded', '2026-09-22T00:00:00Z'), gen('g3', 'b3', 'succeeded', '2026-09-25T00:00:00Z')]
  )
  assert.deepEqual(entries.map((entry) => entry.board.id), ['b1', 'b2', 'b3'])
  assert.deepEqual(entries[0].visualizations, [])
  assert.deepEqual(entries[1].visualizations.map((g) => g.id), ['g1'])
  // Several: newest first, so the card shows the latest.
  assert.deepEqual(entries[2].visualizations.map((g) => g.id), ['g3', 'g2'])
})

test('failed and in-progress visualizations are not shown; in-progress is flagged', () => {
  const [entry] = history.groupDesignHistory(
    [board('b1')],
    [gen('failed', 'b1', 'failed'), gen('busy', 'b1', 'processing'), gen('ok', 'b1')]
  )
  assert.deepEqual(entry.visualizations.map((g) => g.id), ['ok'])
  assert.equal(entry.pending, true)
  const [idle] = history.groupDesignHistory([board('b1')], [gen('failed', 'b1', 'failed')])
  assert.equal(idle.pending, false)
  assert.deepEqual(idle.visualizations, [])
})

test('a visualization whose design was deleted does not appear on its own', () => {
  const entries = history.groupDesignHistory([board('b1')], [gen('orphan', 'gone')])
  assert.equal(entries.length, 1)
  assert.deepEqual(entries[0].visualizations, [])
})

test('My Designs never fetches per board: one board list, one paged visualization list', () => {
  const screen = read('src/app/designs.tsx')
  assert.ok(screen.includes('loadDesignBoards(access.owner'))
  assert.ok(screen.includes('fetchAllDesignGenerations(access.owner.token)'))
  assert.equal(/fetchDesignGeneration\(/.test(screen), false, 'a per-visualization fetch appeared')
  // No generation is created from My Designs, so the feature flag is never bypassed.
  assert.equal(/createDesignGeneration|designGenerationsEnabled/.test(screen), false)
})
