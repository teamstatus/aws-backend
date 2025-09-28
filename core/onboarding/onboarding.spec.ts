import assert from 'node:assert'
import { before, describe, test } from 'node:test'
import type { CoreEvent } from '../CoreEvent.tsx'
import { CoreEventType } from '../CoreEventType.ts'
import { notifier } from '../notifier.ts'
import { createOrganization } from '../persistence/createOrganization.ts'
import { createProject } from '../persistence/createProject.ts'
import { createUser } from '../persistence/createUser.ts'
import type { DbContext } from '../persistence/DbContext.tsx'
import { randomProfile, randomUser } from '../randomEntities.ts'
import { createTestDb } from '../test/createTestDb.ts'
import { ensureUserIsMember } from '../test/ensureUserIsMember.ts'
import { isNotAnError } from '../test/isNotAnError.ts'
import { testDb } from '../test/testDb.ts'
import { onboarding } from './onboarding.ts'

describe('Onboarding', async () => {
	const { TableName, db } = testDb()

	const dbContext: DbContext = {
		db,
		TableName,
	}

	const { on, notify } = notifier()

	before(createTestDb(dbContext))

	await test('that users are automatically added to the $teamstatus#feedback project', async () => {
		const events: CoreEvent[] = []
		on(CoreEventType.PROJECT_MEMBER_CREATED, async (e) => events.push(e))

		await createOrganization(dbContext, notify)(
			{
				id: '$teamstatus',
				name: 'Teamstatus',
			},
			{
				email: 'm@coderbyheart.com',
				sub: '@coderbyheart',
			},
		)
		await createProject(dbContext, notify)(
			{
				id: '$teamstatus#feedback',
				name: 'Feedback',
			},
			{
				email: 'm@coderbyheart.com',
				sub: '@coderbyheart',
			},
		)

		onboarding(dbContext, notify, on)
		const grayUser = randomUser()
		const gray = randomProfile(grayUser)

		isNotAnError(
			await createUser(
				dbContext,
				notify,
			)({
				id: gray.id,
				name: gray.name,
				authContext: gray,
			}),
		)

		const maybeEvent = events.find(
			(e) =>
				e.type === CoreEventType.PROJECT_MEMBER_CREATED &&
				'project' in e &&
				e.project === '$teamstatus#feedback' &&
				'user' in e &&
				e.user === gray.id,
		)
		assert(maybeEvent)

		await ensureUserIsMember(dbContext, grayUser, `$teamstatus#feedback`)
	})
})
