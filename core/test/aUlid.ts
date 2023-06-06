import { stringMatching } from 'tsmatchers'

export const aUlid = () =>
	stringMatching(/[0-7][0-9A-HJKMNP-TV-Z]{25}/gm) as any
