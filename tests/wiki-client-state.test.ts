import assert from 'node:assert/strict'
import test from 'node:test'

import {
  readWikiStateValue,
  readWikiStringArray,
  removeWikiStateValue,
  WIKI_STATE_KEY,
  writeWikiStateValue
} from '../lib/wiki-client-state.ts'

class MemoryStorage {
  #data = new Map<string, string>()

  get length() {
    return this.#data.size
  }

  clear() {
    this.#data.clear()
  }

  getItem(key: string) {
    return this.#data.get(key) ?? null
  }

  key(index: number) {
    return [...this.#data.keys()][index] ?? null
  }

  removeItem(key: string) {
    this.#data.delete(key)
  }

  setItem(key: string, value: string) {
    this.#data.set(key, String(value))
  }
}

function withWindow(run: (storage: MemoryStorage) => void) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const storage = new MemoryStorage()
  const fakeWindow = {
    localStorage: storage,
    dispatchEvent: () => true
  }

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: fakeWindow
  })

  try {
    run(storage)
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous)
    else Reflect.deleteProperty(globalThis, 'window')
  }
}

test('migrates legacy favorites into the consolidated client state', () => {
  withWindow((storage) => {
    storage.setItem(
      'justserver3-favorite-pages-v1',
      JSON.stringify(['aa-bb', 'cc'])
    )

    assert.deepEqual(readWikiStringArray('favoritePages'), ['aa-bb', 'cc'])

    const state = JSON.parse(storage.getItem(WIKI_STATE_KEY) || '{}')
    assert.deepEqual(state.values.favoritePages, ['aa-bb', 'cc'])
  })
})

test('consolidated state wins over legacy state during migration', () => {
  withWindow((storage) => {
    storage.setItem(
      WIKI_STATE_KEY,
      JSON.stringify({
        version: 2,
        values: {
          favoritePages: ['new']
        }
      })
    )
    storage.setItem(
      'justserver3-favorite-pages-v1',
      JSON.stringify(['old'])
    )

    assert.deepEqual(readWikiStringArray('favoritePages'), ['new'])
  })
})

test('writing and removing favorites mirrors the legacy key safely', () => {
  withWindow((storage) => {
    writeWikiStateValue('favoritePages', ['rules', 'mining'])

    assert.deepEqual(
      JSON.parse(storage.getItem('justserver3-favorite-pages-v1') || '[]'),
      ['rules', 'mining']
    )
    assert.deepEqual(readWikiStateValue('favoritePages', []), [
      'rules',
      'mining'
    ])

    removeWikiStateValue('favoritePages')

    assert.equal(storage.getItem('justserver3-favorite-pages-v1'), null)
    assert.deepEqual(readWikiStateValue('favoritePages', []), [])
  })
})

test('string-array reads discard malformed persisted entries', () => {
  withWindow(() => {
    writeWikiStateValue('favoritePages', ['rules', 7, null, 'mining'])
    assert.deepEqual(readWikiStringArray('favoritePages'), ['rules', 'mining'])
  })
})
