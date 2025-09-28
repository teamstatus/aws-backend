import { CoreEventType } from '../CoreEventType.ts'
import type { Notify, onFn } from '../notifier.ts'
import { createProjectMember } from '../persistence/createProjectMember.ts'
import type { UserCreatedEvent } from '../persistence/createUser.ts'
import type { DbContext } from '../persistence/DbContext.ts'
import { Role } from '../Role.ts'

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
