import { QueryCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { type ProblemDetail } from '../ProblemDetail.js'
import type { UserAuthContext } from '../auth.js'
import { type DbContext } from './DbContext.js'
import { l } from './l.js'
import type { Invitation } from './inviteToProject.js'

export const listInvitations =
	(dbContext: DbContext) =>
	async (
		authContext: UserAuthContext,
	): Promise<
		| { error: ProblemDetail }
		| { invitations: Pick<Invitation, 'id' | 'role' | 'inviter'>[] }
	> => {
		const { sub: userId } = authContext

		const { db, TableName } = dbContext
		const { Items } = await db.send(
			new QueryCommand({
				TableName,
				IndexName: 'invitationsForUser',
				KeyConditionExpression: '#invitee = :user',
				ExpressionAttributeNames: {
					'#invitee': 'projectInvitation__invitee',
				},
				ExpressionAttributeValues: {
					':user': {
						S: l(userId),
					},
				},
			}),
		)

		return {
			invitations: (Items ?? []).map((item) =>
				serializeInvitation(unmarshall(item)),
			) as Invitation[],
		}
	}

const serializeInvitation = (
	item: Record<string, any>,
): Pick<Invitation, 'id' | 'role' | 'inviter'> => ({
	id: item.id,
	role: item.role,
	inviter: item.projectInvitation__inviter,
})
