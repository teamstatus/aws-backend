import { Type } from '@sinclair/typebox'
import { validate } from './validate.js'
import { describe, test as it } from 'node:test'
import assert from 'node:assert/strict'

void describe('validate', async () => {
	void (await it('Should check input is valid', async () =>
		assert.equal(validate(Type.Number())(42), 42)))
	void (await it("Should check as 'invalid' values less than 0", () =>
		assert.throws(() => validate(Type.Number({ minimum: 0 }))(-42))))
})
