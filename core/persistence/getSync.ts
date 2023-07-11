import { GetItemCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { type DbContext } from './DbContext.js'
import type { Sync } from './createSync.js'
import type { UserAuthContext } from '../auth.js'
import {
	AccessDeniedError,
	NotFoundError,
	type ProblemDetail,
} from '../ProblemDetail.js'

export type SerializedSync = Omit<Sync, 'projectIds'> & {
	projectIds: string[]
}

export const getSync =
	({ db, TableName }: DbContext) =>
	async (
		{ syncId, sharingToken }: { syncId: string; sharingToken?: string },
		authContext: UserAuthContext,
	): Promise<{ sync: SerializedSync } | { error: ProblemDetail }> => {
		const { Item } = await db.send(
			new GetItemCommand({
				TableName,
				Key: {
					id: {
						S: syncId,
					},
					type: {
						S: 'projectSync',
					},
				},
			}),
		)

		if (Item === undefined)
			return { error: NotFoundError(`Sync ${syncId} not found!`) }
		const sync = itemToSync(unmarshall(Item))

		if (sync.owner !== authContext.sub) {
			if (sharingToken === undefined || sharingToken !== sync.sharingToken) {
				return {
					error: AccessDeniedError(`Access to sync ${syncId} denied.`),
				}
			}
		}

		return { sync: serialize(sync) }
	}

export const serialize = (sync: Sync): SerializedSync => ({
	...sync,
	projectIds: [...sync.projectIds],
})

export const itemToSync = (sync: Record<string, any>): Sync => ({
	id: sync.id,
	title: sync.title ?? undefined,
	projectIds: sync.projectIds,
	owner: sync.sync__owner,
	inclusiveStartDate:
		sync.inclusiveStartDate === null
			? undefined
			: new Date(sync.inclusiveStartDate),
	inclusiveEndDate:
		sync.inclusiveEndDate === null
			? undefined
			: new Date(sync.inclusiveEndDate),
	version: sync.version,
	sharingToken: sync.sharingToken ?? undefined,
})
