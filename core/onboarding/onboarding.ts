import { type UserCreatedEvent } from '../persistence/createUser.js'
import type { DbContext } from '../persistence/DbContext.js'
import { type Notify, type onFn } from '../notifier.js'
import { CoreEventType } from '../CoreEventType.js'
import { createProjectMember } from '../persistence/createProjectMember.js'
import { Role } from '../Role.js'

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
