import assert from 'node:assert/strict'
import { describe, test as it } from 'node:test'
import { checksum } from './checksum.js'

describe('checksum()', () => {
	it('should calculate a checksum', () =>
		assert.equal(
			checksum('alex@example.com'),
			'6db61e6dcbcf2390e4a46af426f26a133a3bee45021422fc7ae86e9136f14110',
		))
})
