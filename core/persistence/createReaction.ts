import { GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import type { CoreEvent } from '../CoreEvent.js'
import { CoreEventType } from '../CoreEventType.js'
import {
	BadRequestError,
	NotFoundError,
	type ProblemDetail,
} from '../ProblemDetail.js'
import type { UserAuthContext } from '../auth.js'
import type { Notify } from '../notifier.js'
import type { DbContext } from './DbContext.js'
import { canWriteReaction } from './getProjectMember.js'
import { l } from './l.js'

export type Reaction =
	| {
			role: string
			emoji: string
			description: string
	  }
	| {
			emoji: string
			description?: string
	  }

export type StatusReaction = {
	id: string
	author: string
	status: string
} & Reaction

export type ReactionCreatedEvent = CoreEvent & {
	type: CoreEventType.REACTION_CREATED
} & StatusReaction

export const createReaction =
	(dbContext: DbContext, notify: Notify) =>
	async (
		reaction: Omit<StatusReaction, 'author'> & { role?: string },
		authContext: UserAuthContext,
	): Promise<{ error: ProblemDetail } | Record<string, never>> => {
		const { sub: userId } = authContext
		const { db, TableName } = dbContext
		const { id, status: statusId, description, emoji } = reaction
		const { Item } = await db.send(
			new GetItemCommand({
				TableName,
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
				error: NotFoundError(`Status '${statusId}' not found!`),
			}

		const status = unmarshall(Item)

		if (
			!(await canWriteReaction(dbContext)(
				status.projectStatus__project,
				userId,
			))
		) {
			return {
				error: BadRequestError(`Only project members can create reactions!`),
			}
		}

		await db.send(
			new PutItemCommand({
				TableName,
				Item: {
					id: {
						S: id,
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
						S: emoji,
					},
					role:
						'role' in reaction && reaction.role !== undefined
							? { S: reaction.role }
							: { NULL: true },
					description:
						description !== undefined ? { S: description } : { NULL: true },
				},
				ConditionExpression: 'attribute_not_exists(id)',
			}),
		)
		const event: ReactionCreatedEvent = {
			type: CoreEventType.REACTION_CREATED,
			...reaction,
			author: userId,
			status: statusId,
			timestamp: new Date(),
		}
		await notify(event)
		return {}
	}
