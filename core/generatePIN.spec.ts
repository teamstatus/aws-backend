import assert from 'node:assert/strict'
import { describe, test as it } from 'node:test'
import { generatePIN } from './generatePIN.ts'

describe('generatePIN()', () => {
	void it('should generate an 8 digit PIN', () => {
		assert.match(generatePIN(), /^[0-9]{8}$/)
	})
	void it('should create unique PINs', () => {
		assert.notEqual(generatePIN(), generatePIN())
	})
})
