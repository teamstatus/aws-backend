import { DeleteItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { l, type AuthContext, type DbContext, type Notify } from '../core'
import {
	createProjectMember,
	type PersistedProjectMember,
} from './createProjectMember'

export const acceptProjectInvitation =
	(dbContext: DbContext, notify: Notify) =>
	async (
		invitationId: string,
		{ userId }: AuthContext,
	): Promise<
		{ projectMembership: PersistedProjectMember } | { error: Error }
	> => {
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
				error: new Error(`Invitation '${invitationId}' not found!`),
			}

		const invitation = unmarshall(Item)

		if (invitation.invitee !== l(userId)) {
			return {
				error: new Error(`Invitation '${invitationId}' is not for you!`),
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
