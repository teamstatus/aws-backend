import assert from 'node:assert/strict'
import { describe, test as it } from 'node:test'
import { ulid } from 'ulid'
import { verifyULID } from './verifyULID.js'
describe('verifyULID()', () => {
	it('should accept a ULID', () => {
		const id = ulid()
		assert.equal(verifyULID(id), id)
	})

	it('should not accept IDs more than five minutes in the future', () =>
		assert.throws(
			() => verifyULID(ulid(Date.now() + 6 * 60 * 1000)),
			/IDs must not be in the future!/,
		))

	it('should not accept IDs more than five minutes in the past', () =>
		assert.throws(
			() => verifyULID(ulid(Date.now() - 6 * 60 * 1000)),
			/IDs must not be in the past!/,
		))
})
