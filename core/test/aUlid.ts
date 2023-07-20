import { StringMatching, stringMatching } from 'tsmatchers'

export const aUlid = (): StringMatching =>
	stringMatching(/[0-7][0-9A-HJKMNP-TV-Z]{25}/gm)
