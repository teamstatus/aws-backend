import { describe, test, before } from 'node:test'
import { createUser } from '../persistence/createUser.ts'
import { testDb } from '../test/testDb.ts'
import type { DbContext } from '../persistence/DbContext.tsx'
import { notifier } from '../notifier.ts'
import { createTestDb } from '../test/createTestDb.ts'
import { arrayContaining, check, objectMatching } from 'tsmatchers'
import { createProject } from '../persistence/createProject.ts'
import type { CoreEvent } from '../CoreEvent.tsx'
import { CoreEventType } from '../CoreEventType.tsx'
import { createOrganization } from '../persistence/createOrganization.ts'
import { onboarding } from './onboarding.ts'
import { ensureUserIsMember } from '../test/ensureUserIsMember.ts'
import { randomProfile, randomUser } from '../randomEntities.ts'
import { eventually } from '../test/eventually.ts'
import { isNotAnError } from '../test/isNotAnError.ts'

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

		eventually(async () => {
			check(events).is(
				arrayContaining(
					objectMatching({
						type: CoreEventType.PROJECT_MEMBER_CREATED,
						project: '$teamstatus#feedback',
						user: gray.id,
					}),
				),
			)
		})

		await ensureUserIsMember(dbContext, grayUser, `$teamstatus#feedback`)
	})
})
