import { describe, it, before } from 'node:test'
import type { CoreEvent } from './CoreEvent'
import { testDb } from './test/testDb'
import type { DbContext } from './persistence/DbContext'
import { notifier } from './notifier'
import { createTestDb } from './test/createTestDb'
import { CoreEventType } from './CoreEventType'
import { ensureUserIsMember, storeEvent } from './core.spec'
import { ulid } from 'ulid'
import { isNotAnError } from './test/isNotAnError'
import { createStatus } from './persistence/createStatus'
import type { UserAuthContext } from './auth'
import Chance from 'chance'
import { createOrganization } from './persistence/createOrganization'
import { aString, arrayContaining, check, objectMatching } from 'tsmatchers'
import { createProject } from './persistence/createProject'
import { getStatus } from './persistence/getStatus'
const chance = new Chance()

describe('status', () => {
	const { TableName, db } = testDb()

	const dbContext: DbContext = {
		db,
		TableName,
	}

	const { on, notify } = notifier()

	before(createTestDb(dbContext))

	it("can be created on behalf of other's", async () => {
		const events: CoreEvent[] = []
		on(CoreEventType.STATUS_CREATED, storeEvent(events))

		const user = randomUser()
		const org = randomOrganization()
		const project = randomProject(org)
		isNotAnError(await createOrganization(dbContext, notify)(org, user))
		isNotAnError(await createProject(dbContext, notify)(project, user))
		await ensureUserIsMember(dbContext, user, project.id)

		const id = ulid()
		isNotAnError(
			await createStatus(dbContext, notify)(
				{
					id,
					projectId: project.id,
					message: `This is a status update by Blake`,
					attributeTo: 'Blake',
				},
				user,
			),
		)
		check(events).is(
			arrayContaining(
				objectMatching({
					type: CoreEventType.STATUS_CREATED,
					project: project.id,
					message: `This is a status update by Blake`,
					author: user.sub,
					id,
					attributeTo: 'Blake',
				}),
			),
		)

		const { status } = isNotAnError(
			await getStatus(dbContext)(
				{
					statusId: id,
					projectId: project.id,
				},
				user,
			),
		)
		check(status).is(
			objectMatching({
				id: aString,
				attributeTo: 'Blake',
			}),
		)
	})
})

const randomUser = (): UserAuthContext => {
	const email = chance.email()
	return {
		email,
		sub: `@${email.split('@')[0]}`,
	}
}

const randomOrganization = (): { id: string; name: string } => ({
	id: `$${chance.word({ syllables: 5 })}`,
	name: chance.company(),
})

const randomProject = (organization: {
	id: string
}): { id: string; name: string } => {
	const projectId = chance.word({ syllables: 5 })
	return {
		id: `${organization.id}#${projectId}`,
		name: `${projectId} project`,
	}
}
