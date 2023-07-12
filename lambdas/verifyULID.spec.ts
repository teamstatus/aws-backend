import assert from 'node:assert/strict'
import { describe, test as it } from 'node:test'
import { ulid } from 'ulid'
import { verifyOlderULID, verifyRecentULID } from './verifyULID.js'
describe('verifyRecentULID()', () => {
	it('should accept a ULID', () => {
		const id = ulid()
		assert.equal(verifyRecentULID(id), id)
	})

	it('should not accept IDs more than five minutes in the future', () =>
		assert.throws(
			() => verifyRecentULID(ulid(Date.now() + 6 * 60 * 1000)),
			/IDs must not be in the future!/,
		))

	it('should not accept IDs more than five minutes in the past', () =>
		assert.throws(
			() => verifyRecentULID(ulid(Date.now() - 6 * 60 * 1000)),
			/IDs must not be in the past!/,
		))
})

describe('verifyOlderULID()', () => {
	it('should accept a ULID', () => {
		const id = ulid()
		assert.equal(verifyOlderULID(id), id)
	})

	it('should not accept IDs more than five minutes in the future', () =>
		assert.throws(
			() => verifyOlderULID(ulid(Date.now() + 6 * 60 * 1000)),
			/IDs must not be in the future!/,
		))

	it('should accept IDs more than five minutes in the past', () => {
		const id = ulid(Date.now() - 6 * 60 * 1000)
		assert.equal(verifyOlderULID(id), id)
	})
})
