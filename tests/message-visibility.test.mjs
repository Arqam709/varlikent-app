// "Delete for me" and "Delete conversation" in the property Chats — the pure
// state rules (utils/message-visibility.ts), and thread recovery converging on
// what the server says this user may see (utils/recover-thread-messages.ts).
//
// Both actions are per-user: nothing here models the other participant, whose
// view never changes.
//
// Pure: both modules have type-only imports, so they are transpiled and run
// directly.

import test, { before } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const load = (relative) => {
  const source = fs.readFileSync(path.join(ROOT, relative), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  const module = { exports: {} }
  const require = (id) => {
    throw new Error(`${relative} imported an unexpected module: ${id}`)
  }
  new Function('exports', 'module', 'require', outputText)(module.exports, module, require)
  return module.exports
}

let visibility
let recovery

before(() => {
  visibility = load('src/utils/message-visibility.ts')
  recovery = load('src/utils/recover-thread-messages.ts')
})

const ME = 'user-me'
const AGENT = 'user-agent'

// Ids sort in creation order, like ObjectIds.
const msg = (n, sender = ME) => ({
  _id: `m${String(n).padStart(3, '0')}`,
  sender,
  text: `message ${n}`,
  createdAt: new Date(2026, 0, 1, 10, n).toISOString(),
})

const row = (id, at, extra = {}) => ({
  _id: id,
  status: 'open',
  role: 'customer',
  property: null,
  counterparty: { _id: AGENT, name: 'Mehmet' },
  lastMessage: { text: "I'm interested", sender: ME, at },
  lastActivityAt: at,
  unreadCount: 2,
  createdAt: at,
  ...extra,
})

// ── Who is offered "Delete for me" ───────────────────────────────────────

test('only my own messages offer Delete for me (V1)', () => {
  assert.equal(visibility.canHideMessage(msg(1, ME), ME), true)
  assert.equal(visibility.canHideMessage(msg(1, AGENT), ME), false)
  assert.equal(visibility.canHideMessage(msg(1, ME), null), false)
  assert.equal(visibility.canHideMessage(null, ME), false)
})

// ── Thread ───────────────────────────────────────────────────────────────

test('a hidden message leaves the thread completely — no placeholder', () => {
  const list = [msg(1), msg(2, AGENT), msg(3)]
  const next = visibility.removeMessageById(list, 'm002')
  assert.deepEqual(next.map((m) => m._id), ['m001', 'm003'])
})

test('removing a message that is not loaded changes nothing', () => {
  const list = [msg(1)]
  assert.equal(visibility.removeMessageById(list, 'm009'), list)
})

test('a failed hide puts the message back in its original place', () => {
  const original = [msg(1), msg(2), msg(3)]
  const removed = visibility.removeMessageById(original, 'm002')
  assert.deepEqual(recovery.mergeMessagesById(removed, [msg(2)]).map((m) => m._id), ['m001', 'm002', 'm003'])
})

// ── Inbox ────────────────────────────────────────────────────────────────

test('hiding my newest message updates only my row preview, not its unread count', () => {
  const at = '2026-01-01T10:05:00.000Z'
  const list = [row('c1', at), row('c2', at)]
  const next = visibility.applyHiddenMessageToConversations(list, {
    conversationId: 'c1',
    lastMessage: { text: 'Hello', sender: AGENT, at: '2026-01-01T10:01:00.000Z' },
    inInbox: true,
  })
  assert.equal(next[0].lastMessage.text, 'Hello')
  assert.equal(next[0].unreadCount, 2)
  assert.equal(next[0].lastActivityAt, at)
  assert.equal(next[1], list[1])
})

test('hiding my last visible message removes the row', () => {
  const list = [row('c1', '2026-01-01T10:05:00.000Z'), row('c2', '2026-01-01T10:04:00.000Z')]
  const next = visibility.applyHiddenMessageToConversations(list, {
    conversationId: 'c1',
    lastMessage: null,
    inInbox: false,
  })
  assert.deepEqual(next.map((r) => r._id), ['c2'])
})

test('malformed or unknown hide events are ignored', () => {
  const list = [row('c1', '2026-01-01T10:05:00.000Z')]
  assert.equal(visibility.applyHiddenMessageToConversations(list, null), list)
  assert.equal(
    visibility.applyHiddenMessageToConversations(list, { conversationId: 'nope', lastMessage: null, inInbox: true }),
    list
  )
})

test('Delete conversation removes the row; a failure restores it in activity order', () => {
  const older = row('c-old', '2026-01-01T09:00:00.000Z')
  const target = row('c-mid', '2026-01-01T10:00:00.000Z')
  const newer = row('c-new', '2026-01-01T11:00:00.000Z')
  const list = [newer, target, older]

  const removed = visibility.removeConversationById(list, 'c-mid')
  assert.deepEqual(removed.map((r) => r._id), ['c-new', 'c-old'])

  const restored = visibility.restoreConversation(removed, target)
  assert.deepEqual(restored.map((r) => r._id), ['c-new', 'c-mid', 'c-old'])
})

test('restoring never duplicates a row that has already come back', () => {
  const list = [row('c1', '2026-01-01T10:00:00.000Z')]
  assert.equal(visibility.restoreConversation(list, row('c1', '2026-01-01T10:00:00.000Z')), list)
})

// ── Recovery converges on the server's view ──────────────────────────────

const page = (messages, extra = {}) => ({ messages, contiguous: true, nextCursor: null, hasMore: false, ...extra })

test('a message hidden on another device leaves this one after a reconnect', () => {
  const current = [msg(1), msg(2), msg(3, AGENT), msg(4)]
  // The server no longer returns m002 to this user.
  const { messages } = recovery.applyRecovery(current, page([msg(1), msg(3, AGENT), msg(4)]))
  assert.deepEqual(messages.map((m) => m._id), ['m001', 'm003', 'm004'])
})

test('recovery only judges the window it actually fetched', () => {
  const current = [msg(1), msg(2), msg(5), msg(6)]
  // Fetched m005..m007, with more history behind: m001/m002 were not checked.
  const { messages } = recovery.applyRecovery(
    current,
    page([msg(5), msg(7)], { hasMore: true, nextCursor: 'm005' })
  )
  assert.deepEqual(messages.map((m) => m._id), ['m001', 'm002', 'm005', 'm007'])
})

test('messages newer than the fetch (arrived by socket) are kept', () => {
  const current = [msg(1), msg(2), msg(9)]
  const { messages } = recovery.applyRecovery(current, page([msg(1), msg(2)]))
  assert.deepEqual(messages.map((m) => m._id), ['m001', 'm002', 'm009'])
})

test('a conversation cleared elsewhere empties this thread after a reconnect', () => {
  const current = [msg(1), msg(2, AGENT)]
  const { messages } = recovery.applyRecovery(current, page([]))
  assert.deepEqual(messages, [])
})

test('new messages after a clear replace the cleared history on reconnect', () => {
  const current = [msg(1), msg(2, AGENT)]
  const { messages } = recovery.applyRecovery(current, page([msg(8, AGENT)]))
  assert.deepEqual(messages.map((m) => m._id), ['m008'])
})

test('a recovery that changes nothing keeps the same array', () => {
  const current = [msg(1), msg(2)]
  assert.equal(recovery.applyRecovery(current, page([msg(1), msg(2)])).messages, current)
})

test('an empty page with more history behind it is not treated as a clear', () => {
  const current = [msg(1)]
  const { messages } = recovery.applyRecovery(current, page([], { hasMore: true, nextCursor: 'x' }))
  assert.equal(messages, current)
})
