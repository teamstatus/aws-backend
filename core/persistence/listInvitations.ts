import { QueryCommand } from '@aws-sdk/client-dynamodb'
import { type NativeAttributeValue, unmarshall } from '@aws-sdk/util-dynamodb'
import type { UserAuthContext } from '../auth.ts'
import type { ProblemDetail } from '../ProblemDetail.ts'
import type { DbContext } from './DbContext.ts'
import { invitationsForUserIndex } from './db.ts'
import type { Invitation } from './inviteToProject.ts'
import { l } from './l.ts'

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
				IndexName: invitationsForUserIndex,
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
	item: Record<string, NativeAttributeValue>,
): Pick<Invitation, 'id' | 'role' | 'inviter'> => ({
	id: item.id,
	role: item.role,
	inviter: item.projectInvitation__inviter,
})
