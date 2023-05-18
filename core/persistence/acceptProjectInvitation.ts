import { DeleteItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import {
	BadRequestError,
	NotFoundError,
	type ProblemDetail,
} from '../ProblemDetail.js'
import type { Notify } from '../notifier.js'
import type { VerifyTokenUserFn } from '../token.js'
import { type DbContext } from './DbContext.js'
import {
	createProjectMember,
	type PersistedProjectMember,
} from './createProjectMember.js'
import { l } from './l.js'

export const acceptProjectInvitation =
	(verifyToken: VerifyTokenUserFn, dbContext: DbContext, notify: Notify) =>
	async (
		invitationId: string,
		token: string,
	): Promise<
		{ projectMembership: PersistedProjectMember } | { error: ProblemDetail }
	> => {
		const { sub: userId } = verifyToken(token)
		const { db, table } = dbContext
		const { Item } = await db.send(
			new GetItemCommand({
				TableName: table,
				Key: {
					id: {
						S: invitationId,
					},
					type: {
						S: 'projectInvitation',
					},
				},
			}),
		)

		if (Item === undefined)
			return {
				error: NotFoundError(`Invitation '${invitationId}' not found!`),
			}

		const invitation = unmarshall(Item)

		if (invitation.invitee !== l(userId)) {
			return {
				error: BadRequestError(`Invitation '${invitationId}' is not for you!`),
			}
		}

		const [projectMembership] = await Promise.all([
			createProjectMember(dbContext, notify)(
				invitation.projectInvitation__project,
				invitation.invitee,
				invitation.role,
			),
			db.send(
				new DeleteItemCommand({
					TableName: table,
					Key: {
						id: {
							S: invitationId,
						},
						type: {
							S: 'projectInvitation',
						},
					},
				}),
			),
		])

		return {
			projectMembership,
		}
	}
