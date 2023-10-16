import type { UserAuthContext } from './auth'
import Chance from 'chance'
import type { User } from './persistence/createUser'
import { randomUUID } from 'node:crypto'
export const chance = new Chance()

export const randomUser = (): UserAuthContext => {
	const [user, domain] = chance.email().split('@')
	const sub = `${user}-${randomUUID()}`
	return {
		email: `${sub}@${domain}`,
		sub: `@${sub}`,
	}
}

export const randomProfile = (userAuthContext: UserAuthContext): User => ({
	id: userAuthContext.sub,
	email: userAuthContext.email,
	name: chance.name(),
	version: 1,
})
export const randomOrganization = (): { id: string; name: string } => ({
	id: `$${chance.word({ syllables: 5 })}`,
	name: chance.company(),
})
export const randomProject = (organization: {
	id: string
}): { id: string; name: string } => {
	const projectId = chance.word({ syllables: 5 })
	return {
		id: `${organization.id}#${projectId}`,
		name: `${projectId} project`,
	}
}
