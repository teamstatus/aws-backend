import type { Static, TSchema } from '@sinclair/typebox'
import type { ValueError } from '@sinclair/typebox/errors'
import { validateWithTypeBox } from '../util/validateWithTypeBox.ts'

export const validate = <T extends TSchema>(
	schema: T,
): ((value: unknown) => Static<typeof schema>) => {
	const v = validateWithTypeBox(schema)
	return (value: unknown) => {
		const maybeValid = v(value)
		if ('errors' in maybeValid) {
			throw new InputValidationError(maybeValid.errors)
		}
		return value as Static<typeof schema>
	}
}

export class InputValidationError extends Error {
	constructor(errors: ValueError[]) {
		super(`Input validation failed: ${JSON.stringify(errors)}`)
		this.name = 'InputValidationError'
	}
}
