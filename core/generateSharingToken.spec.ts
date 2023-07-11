import { describe, test as it } from 'node:test'
import { check, not, stringMatching } from 'tsmatchers'
import { generateSharingToken } from './generateSharingToken.js'

describe('generateSharingToken()', () => {
	void it('should generate an 32 character sharing token', () =>
		check(generateSharingToken()).is(stringMatching(/^[a-f0-9]{64}$/)))

	void it('should create unique sharing tokens', () =>
		check(generateSharingToken()).is(
			not(stringMatching(generateSharingToken())),
		))
})
