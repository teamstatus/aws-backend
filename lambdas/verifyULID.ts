import { decodeTime } from 'ulid'
import { Type } from '@sinclair/typebox'

const fiveMinutes = 5 * 60 * 1000

const ULIDRegExp = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/

export const ULID = Type.RegExp(ULIDRegExp, { title: 'ULID' })

export const verifyRecentULID = (id: string): string => {
	if (!ULIDRegExp.test(id)) throw new Error(`Not a ULID: ${id}`)

	const ts = decodeTime(id)
	const diff = ts - Date.now()

	if (diff < -fiveMinutes) throw new Error('IDs must not be in the past!')

	if (diff > fiveMinutes) throw new Error('IDs must not be in the future!')

	return id
}

export const verifyOlderULID = (id: string): string => {
	if (!ULIDRegExp.test(id)) throw new Error(`Not a ULID: ${id}`)

	const ts = decodeTime(id)
	const diff = ts - Date.now()

	if (diff > fiveMinutes) throw new Error('IDs must not be in the future!')

	return id
}
