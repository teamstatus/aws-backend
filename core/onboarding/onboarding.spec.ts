import { describe, test, before } from 'node:test'
import { createUser } from '../persistence/createUser'
import { testDb } from '../test/testDb'
import type { DbContext } from '../persistence/DbContext'
import { notifier } from '../notifier'
import { createTestDb } from '../test/createTestDb'
import type { UserAuthContext } from '../auth'
import { arrayContaining, check, objectMatching } from 'tsmatchers'
import { createProject } from '../persistence/createProject'
import type { CoreEvent } from '../CoreEvent'
import { CoreEventType } from '../CoreEventType'
import { createOrganization } from '../persistence/createOrganization'
import { onboarding } from './onboarding'
import { ensureUserIsMember } from '../core.spec'

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
		const gray: UserAuthContext = {
			email: 'gray@example.com',
			sub: '@gray',
		}
		await createUser(
			dbContext,
			notify,
		)({
			id: '@gray',
			name: 'Gray',
			authContext: { email: 'gray@example.com' },
		})

		check(events).is(
			arrayContaining(
				objectMatching({
					type: CoreEventType.PROJECT_MEMBER_CREATED,
					project: '$teamstatus#feedback',
					user: gray.sub,
				}),
			),
		)

		await ensureUserIsMember(dbContext, gray, `$teamstatus#feedback`)
	})
})
