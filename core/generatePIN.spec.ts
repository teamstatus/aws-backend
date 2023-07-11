import { describe, test as it } from 'node:test'
import { check, stringMatching } from 'tsmatchers'
import { generatePIN } from './generatePIN.js'

describe('generatePIN()', () => {
	void it('should generate an 8 digit PIN', () =>
		check(generatePIN()).is(stringMatching(/^[0-9]{8}$/)))
})
