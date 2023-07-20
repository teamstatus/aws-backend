import { createHash } from 'node:crypto'

export const checksum = (input: string): string => {
	const hash = createHash('sha256')
	hash.update(input)
	return hash.digest('hex')
}
