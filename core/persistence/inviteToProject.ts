import { PutItemCommand } from '@aws-sdk/client-dynamodb'
import { ulid } from 'ulid'
import {
	CoreEventType,
	Role,
	l,
	type CoreEvent,
	type DbContext,
} from '../core.js'
import { parseProjectId } from '../ids.js'
import type { Notify } from '../notifier.js'
import type { VerifyTokenUserFn } from '../token.js'
import { isOrganizationOwner } from './getOrganizationMember.js'

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
	(verifyToken: VerifyTokenUserFn, dbContext: DbContext, notify: Notify) =>
	async (
		invitedUserId: string,
		projectId: string,
		token: string,
	): Promise<{ error: Error } | { invitation: PersistedInvitation }> => {
		const { sub: userId } = verifyToken(token)
		const { organization: organizationId } = parseProjectId(projectId)

		if (organizationId === null) {
			return {
				error: new Error(`Not a valid project ID: ${projectId}`),
			}
		}

		if (!(await isOrganizationOwner(dbContext)(organizationId, userId))) {
			return {
				error: new Error(
					`Only members of ${organizationId} can view projects.`,
				),
			}
		}

		const id = ulid()

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
