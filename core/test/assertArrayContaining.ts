import assert from 'node:assert'

export const assertArrayContaining = (
	arr: Array<Record<string, unknown>>,
	obj: Record<string, unknown>,
): void =>
	assert.ok(
		arr.some((a) => {
			return Object.entries(obj).every(([key, value]) => {
				return a[key] === value
			})
		}),
	)
