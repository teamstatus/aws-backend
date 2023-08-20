import { type UserCreatedEvent } from '../persistence/createUser'
import type { DbContext } from '../persistence/DbContext'
import { type Notify, type onFn } from '../notifier'
import { CoreEventType } from '../CoreEventType'
import { createProjectMember } from '../persistence/createProjectMember'
import { Role } from '../Role'

export const onboarding = (dbContext: DbContext, notify: Notify, on: onFn) => {
	const create = createProjectMember(dbContext, notify)
	on(CoreEventType.USER_CREATED, async (event) => {
		await create(
			`$teamstatus#feedback`,
			(event as UserCreatedEvent).id,
			Role.MEMBER,
		)
	})
}
