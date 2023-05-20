import { PutItemCommand } from '@aws-sdk/client-dynamodb'
import { type CoreEvent } from '../CoreEvent.js'
import { CoreEventType } from '../CoreEventType.js'
import { BadRequestError, type ProblemDetail } from '../ProblemDetail.js'
import { Role } from '../Role.js'
import type { UserAuthContext } from '../auth.js'
import { parseProjectId } from '../ids.js'
import type { Notify } from '../notifier.js'
import { type DbContext } from './DbContext.js'
import { isOrganizationOwner } from './getOrganizationMember.js'
import { l } from './l.js'

export type MemberInvitedEvent = CoreEvent & {
	type: CoreEventType.PROJECT_MEMBER_INVITED
} & PersistedInvitation

export type PersistedInvitation = {
	id: string
	project: string
	invitee: string
	inviter: string
	role: Role
}

export const inviteToProject =
	(dbContext: DbContext, notify: Notify) =>
	async (
		invitedUserId: string,
		projectId: string,
		authContext: UserAuthContext,
	): Promise<
		{ error: ProblemDetail } | { invitation: PersistedInvitation }
	> => {
		const { sub: userId } = authContext
		const { organization: organizationId } = parseProjectId(projectId)

		if (organizationId === null) {
			return {
				error: BadRequestError(`Not a valid project ID: ${projectId}`),
			}
		}

		if (!(await isOrganizationOwner(dbContext)(organizationId, userId))) {
			return {
				error: BadRequestError(
					`Only members of ${organizationId} can view projects.`,
				),
			}
		}

		const id = `${l(projectId)}:${l(invitedUserId)}`
		const { db, table } = dbContext
		await db.send(
			new PutItemCommand({
				TableName: table,
				Item: {
					id: {
						S: id,
					},
					type: {
						S: 'projectInvitation',
					},
					projectInvitation__project: {
						S: l(projectId),
					},
					invitee: {
						S: l(invitedUserId),
					},
					inviter: {
						S: l(userId),
					},
					role: {
						S: Role.MEMBER,
					},
				},
			}),
		)
		const invitation: PersistedInvitation = {
			id,
			project: projectId,
			invitee: invitedUserId,
			inviter: userId,
			role: Role.MEMBER,
		}
		const event: MemberInvitedEvent = {
			type: CoreEventType.PROJECT_MEMBER_INVITED,
			...invitation,
			timestamp: new Date(),
		}
		notify(event)
		return { invitation }
	}
