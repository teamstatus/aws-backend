import {
	ConditionalCheckFailedException,
	GetItemCommand,
	PutItemCommand,
} from '@aws-sdk/client-dynamodb'
import { type CoreEvent } from '../CoreEvent.js'
import { CoreEventType } from '../CoreEventType.js'
import {
	BadRequestError,
	ConflictError,
	InternalError,
	NotFoundError,
	type ProblemDetail,
} from '../ProblemDetail.js'
import { Role } from '../Role.js'
import { type UserAuthContext } from '../auth.js'
import { parseProjectId } from '../ids.js'
import type { Notify } from '../notifier.js'
import { type DbContext } from './DbContext.js'
import { isOrganizationOwner } from './getOrganizationMember.js'
import { l } from './l.js'

export type MemberInvitedEvent = CoreEvent & {
	type: CoreEventType.PROJECT_MEMBER_INVITED
} & Invitation

export type Invitation = {
	id: string
	project: string
	invitee: string
	inviter: string
	role: Role
}

export const inviteToProject =
	(dbContext: DbContext, notify: Notify) =>
	async (
		{
			invitedUserId,
			projectId,
			role,
		}: {
			invitedUserId: string
			projectId: string
			role: Role
		},
		authContext: UserAuthContext,
	): Promise<{ error: ProblemDetail } | { id: string }> => {
		try {
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

			if (![Role.WATCHER, Role.MEMBER, Role.OWNER].includes(role)) {
				return {
					error: BadRequestError(`${role} is not a valid role.`),
				}
			}

			const { db, TableName } = dbContext

			const { Item } = await db.send(
				new GetItemCommand({
					TableName,
					Key: {
						id: {
							S: l(invitedUserId),
						},
						type: {
							S: 'user',
						},
					},
				}),
			)

			if (Item === undefined)
				return {
					error: NotFoundError(`User ${invitedUserId} does not exist.`),
				}

			const id = createInvitationId({ projectId, invitedUserId })
			await db.send(
				new PutItemCommand({
					TableName,
					Item: {
						id: {
							S: l(id),
						},
						type: {
							S: 'projectInvitation',
						},
						projectInvitation__project: {
							S: l(projectId),
						},
						projectInvitation__invitee: {
							S: l(invitedUserId),
						},
						projectInvitation__inviter: {
							S: l(userId),
						},
						role: {
							S: role,
						},
					},
					ConditionExpression: 'attribute_not_exists(id)',
				}),
			)
			const event: MemberInvitedEvent = {
				type: CoreEventType.PROJECT_MEMBER_INVITED,
				id: l(id),
				project: projectId,
				invitee: invitedUserId,
				inviter: userId,
				role,
				timestamp: new Date(),
			}
			notify(event)

			return { id }
		} catch (error) {
			if ((error as Error).name === ConditionalCheckFailedException.name)
				return {
					error: ConflictError(`User '${invitedUserId}' already invited.`),
				}
			console.error(error)
			return { error: InternalError() }
		}
	}

export const createInvitationId = ({
	projectId,
	invitedUserId,
}: {
	projectId: string
	invitedUserId: string
}): string => `${l(projectId)}${l(invitedUserId)}`
