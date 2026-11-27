import { test } from 'node:test'
import assert from 'node:assert/strict'
import { alternarBono, sesionAdmiteBono } from '../bonosSesion.js'

test('qué bonos admite una sesión', () => {
  assert.equal(sesionAdmiteBono(null, 'a'), true)
  assert.equal(sesionAdmiteBono(undefined, 'a'), true) // antes de sql/113
  assert.equal(sesionAdmiteBono([], 'a'), false)
  assert.equal(sesionAdmiteBono(['a'], 'a'), true)
  assert.equal(sesionAdmiteBono(['a'], 'b'), false)
})

test('marcar y desmarcar bonos', () => {
  const todos = ['a', 'b']
  assert.deepEqual(alternarBono(null, 'a', todos), ['b'])
  assert.equal(alternarBono(['b'], 'a', todos), null) // vuelven a estar todos
  assert.deepEqual(alternarBono(['b'], 'b', todos), [])
  assert.deepEqual(alternarBono([], 'a', todos), ['a'])
})
