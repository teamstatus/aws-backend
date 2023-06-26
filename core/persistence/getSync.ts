import { GetItemCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { type DbContext } from './DbContext.js'
import type { Sync } from './createSync.js'

export type SerializedSync = Omit<Sync, 'projectIds'> & {
	projectIds: string[]
}

export const getSync =
	({ db, TableName }: DbContext) =>
	async (syncId: string): Promise<SerializedSync | null> => {
		const { Item } = await db.send(
			new GetItemCommand({
				TableName,
				Key: {
					id: {
						S: syncId,
					},
					type: {
						S: 'sync',
					},
				},
			}),
		)

		if (Item === undefined) return null
		const sync = itemToSync(unmarshall(Item))

		return serialize(sync)
	}

export const serialize = (sync: Sync): SerializedSync => ({
	...sync,
	projectIds: [...sync.projectIds],
})

export const itemToSync = (sync: Record<string, any>): Sync => ({
	id: sync.id,
	title: sync.title,
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
})
