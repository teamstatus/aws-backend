import assert from 'node:assert'

export const aUlid = (id?: string): void => {
	assert(id !== undefined)
	assert.match(id, /[0-7][0-9A-HJKMNP-TV-Z]{25}/gm)
}
