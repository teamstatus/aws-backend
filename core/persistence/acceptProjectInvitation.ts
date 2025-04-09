import { DeleteItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import {
	BadRequestError,
	NotFoundError,
	type ProblemDetail,
} from '../ProblemDetail.ts'
import type { UserAuthContext } from '../auth.ts'
import type { Notify } from '../notifier.ts'
import type { DbContext } from './DbContext.ts'
import { createProjectMember } from './createProjectMember.ts'
import { l } from './l.ts'
import { createInvitationId } from './inviteToProject.ts'

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

		if (Item === undefined) {
			return {
				error: NotFoundError(`Invitation '${id}' not found!`),
			}
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
