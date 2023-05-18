import { GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { CoreEventType, l, type CoreEvent, type DbContext } from '../core.js'
import type { Notify } from '../notifier.js'
import type { VerifyTokenUserFn } from '../token.js'
import { verifyULID } from '../verifyULID.js'
import { isProjectMember } from './getProjectMember.js'

// Reactions can have special roles
export enum ReactionRole {
	// A significant thing happened, makes the status stand out from others in the list of status
	SIGNIFICANT = 'SIGNIFICANT',
	// The status needs to be discussed during the next sync meeting, this will collect this status in a separate list of open questions during the next sync meeting
	QUESTION = 'QUESTION',
}

export type Reaction =
	| {
			role: ReactionRole
			emoji: string
			description: string
	  }
	| {
			emoji: string
			description?: string
	  }

export type PersistedReaction = {
	id: string
	author: string
	status: string
} & Reaction

export const bugFix: Reaction = {
	description: 'A bug was fixed',
	emoji: '🐞',
	role: ReactionRole.SIGNIFICANT,
}

export const newVersionRelease: Reaction = {
	description: 'A new version was released',
	emoji: '🚀',
	role: ReactionRole.SIGNIFICANT,
}

export const question: Reaction = {
	description: 'This item needs to be discussed during the next sync meeting',
	emoji: '🙋',
	role: ReactionRole.QUESTION,
}

export const praise: Reaction = {
	emoji: '🌟',
	description: 'This is amazing!',
}

export const thumbsUp = {
	emoji: '👍',
}

export type ReactionCreatedEvent = CoreEvent & {
	type: CoreEventType.REACTION_CREATED
} & PersistedReaction

export const createReaction =
	(verifyToken: VerifyTokenUserFn, dbContext: DbContext, notify: Notify) =>
	async (
		id: string,
		statusId: string,
		reaction: Reaction,
		token: string,
	): Promise<{ error: Error } | { reaction: PersistedReaction }> => {
		const { sub: userId } = verifyToken(token)
		const { db, table } = dbContext
		const { Item } = await db.send(
			new GetItemCommand({
				TableName: table,
				Key: {
					id: {
						S: statusId,
					},
					type: {
						S: 'projectStatus',
					},
				},
			}),
		)

		if (Item === undefined)
			return {
				error: new Error(`Status '${statusId}' not found!`),
			}

		const status = unmarshall(Item)

		if (
			!(await isProjectMember(dbContext)(status.projectStatus__project, userId))
		) {
			return {
				error: new Error(`Only project members can create reactions!`),
			}
		}

		await db.send(
			new PutItemCommand({
				TableName: table,
				Item: {
					id: {
						S: verifyULID(id),
					},
					type: {
						S: 'statusReaction',
					},
					statusReaction__status: {
						S: statusId,
					},
					author: {
						S: l(userId),
					},
					emoji: {
						S: reaction.emoji,
					},
					role: 'role' in reaction ? { S: reaction.role } : { NULL: true },
					description:
						'description' in reaction && reaction.description !== undefined
							? { S: reaction.description }
							: { NULL: true },
				},
			}),
		)
		const persistedReaction: PersistedReaction = {
			id,
			...reaction,
			author: userId,
			status: statusId,
		}
		const event: ReactionCreatedEvent = {
			type: CoreEventType.REACTION_CREATED,
			...persistedReaction,
			timestamp: new Date(),
		}
		notify(event)
		return { reaction: persistedReaction }
	}
