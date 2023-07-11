import { PutItemCommand } from '@aws-sdk/client-dynamodb'
import { type CoreEvent } from '../CoreEvent.js'
import { CoreEventType } from '../CoreEventType.js'
import { BadRequestError, type ProblemDetail } from '../ProblemDetail.js'
import type { UserAuthContext } from '../auth.js'
import type { Notify } from '../notifier.js'
import { verifyULID } from '../verifyULID.js'
import { type DbContext } from './DbContext.js'
import { canReadProjects } from './canReadProjects.js'
import { l } from './l.js'

type SyncCreatedEvent = CoreEvent & {
	type: CoreEventType.SYNC_CREATED
} & Sync

export type Sync = {
	title?: string
	projectIds: Set<string>
	owner: string
	id: string
	inclusiveStartDate?: Date
	inclusiveEndDate?: Date
	version: number
	sharingToken?: string
}

export const createSync =
	(dbContext: DbContext, notify: Notify) =>
	async (
		{
			id,
			projectIds,
			title,
			inclusiveStartDate,
			inclusiveEndDate,
		}: {
			id: string
			projectIds: Set<string>
			title?: string
			inclusiveStartDate?: Date
			inclusiveEndDate?: Date
		},
		authContext: UserAuthContext,
	): Promise<{ error: ProblemDetail } | Record<string, never>> => {
		const { sub: userId } = authContext

		if (!(await canReadProjects(dbContext)(projectIds, authContext))) {
			return {
				error: BadRequestError(
					`Only members of '${[...projectIds].join(
						',',
					)}' are allowed to create a sync.`,
				),
			}
		}

		const { db, TableName } = dbContext
		await db.send(
			new PutItemCommand({
				TableName,
				Item: {
					id: {
						S: verifyULID(id),
					},
					type: {
						S: 'projectSync',
					},
					projectIds: {
						SS: [...projectIds],
					},
					sync__owner: {
						S: l(userId),
					},
					version: {
						N: '1',
					},
					title:
						title === undefined
							? { NULL: true }
							: {
									S: title,
							  },
					inclusiveStartDate:
						inclusiveStartDate === undefined
							? { NULL: true }
							: { S: inclusiveStartDate.toISOString() },
					inclusiveEndDate:
						inclusiveEndDate === undefined
							? { NULL: true }
							: { S: inclusiveEndDate.toISOString() },
				},
			}),
		)
		const event: SyncCreatedEvent = {
			type: CoreEventType.SYNC_CREATED,
			title,
			owner: userId,
			id,
			projectIds,
			timestamp: new Date(),
			inclusiveStartDate,
			inclusiveEndDate,
			version: 1,
		}
		notify(event)
		return {}
	}
