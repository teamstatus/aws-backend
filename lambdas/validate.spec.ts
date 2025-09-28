import assert from 'node:assert/strict'
import { describe, test as it } from 'node:test'
import { Type } from '@sinclair/typebox'
import { ulid } from 'ulid'
import { ProjectId } from '../core/ids.ts'
import { validate } from './validate.ts'
import { ULID } from './verifyULID.ts'

void describe('validate', async () => {
	void (await it('Should check input is valid', async () =>
		assert.equal(validate(Type.Number())(42), 42)))
	void (await it("Should check as 'invalid' values less than 0", () =>
		assert.throws(() => validate(Type.Number({ minimum: 0 }))(-42))))

	void it('should validate an ID', () => {
		const data = {
			id: ulid(),
			message:
				'The first version of the authorizer for Traefik has been released to prod',
			attributeTo: undefined,
			projectId: '$nrfcloud#account',
		}

		const validator = validate(
			Type.Object({
				id: ULID,
				message: Type.String({ minLength: 1, title: 'Message' }),
				projectId: ProjectId,
				attributeTo: Type.Optional(
					Type.String({ minLength: 1, title: 'Non-empty string' }),
				),
			}),
		)

		assert.deepEqual(validator(data), data)
	})
})
