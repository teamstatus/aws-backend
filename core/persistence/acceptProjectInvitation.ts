import { DeleteItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import {
	BadRequestError,
	NotFoundError,
	type ProblemDetail,
} from '../ProblemDetail.js'
import type { UserAuthContext } from '../auth.js'
import type { Notify } from '../notifier.js'
import type { DbContext } from './DbContext.js'
import { createProjectMember } from './createProjectMember.js'
import { l } from './l.js'
import { createInvitationId } from './inviteToProject.js'

export const acceptProjectInvitation =
	(dbContext: DbContext, notify: Notify) =>
	async (
		projectId: string,
		authContext: UserAuthContext,
	): Promise<{ error: ProblemDetail } | Record<string, never>> => {
		const { sub: userId } = authContext
		const id = createInvitationId({ projectId, invitedUserId: userId })
		const { db, TableName } = dbContext
		const { Item } = await db.send(
			new GetItemCommand({
				TableName,
				Key: {
					id: {
						S: id,
					},
					type: {
						S: 'projectInvitation',
					},
				},
			}),
		)

		if (Item === undefined)
			return {
				error: NotFoundError(`Invitation '${id}' not found!`),
			}

		const invitation = unmarshall(Item)

		if (invitation.projectInvitation__invitee !== l(userId)) {
			return {
				error: BadRequestError(`Invitation '${id}' is not for you!`),
			}
		}

		await Promise.all([
			createProjectMember(dbContext, notify)(
				invitation.projectInvitation__project,
				invitation.projectInvitation__invitee,
				invitation.role,
			),
			db.send(
				new DeleteItemCommand({
					TableName,
					Key: {
						id: {
							S: id,
						},
						type: {
							S: 'projectInvitation',
						},
					},
				}),
			),
		])

		return {}
	}
