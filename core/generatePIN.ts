import { randomUUID } from 'node:crypto'

export const generatePIN = (length = 8): string => {
	let pin = ''
	do {
		pin = `${pin}${randomUUID()}`
			.split('')
			.filter((s) => /[0-9]/.test(s))
			.join('')
	} while (pin.length < length)
	return pin.slice(0, length)
}
