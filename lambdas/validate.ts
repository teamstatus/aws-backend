import type { Static, TSchema } from '@sinclair/typebox'
import Ajv, { type ErrorObject } from 'ajv'

export const validate = <T extends TSchema>(
	schema: T,
): ((value: unknown) => Static<typeof schema>) => {
	const ajv = new Ajv()
	const v = ajv.compile(schema)
	return (value: unknown) => {
		const valid = v(value)
		if (valid !== true) {
			throw new InputValidationError(v.errors as ErrorObject[])
		}
		return value as Static<typeof schema>
	}
}

export class InputValidationError extends Error {
	constructor(errors: ErrorObject[]) {
		super(`Input validation failed: ${JSON.stringify(errors)}`)
		this.name = 'InputValidationError'
	}
}
