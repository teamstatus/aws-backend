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
import { listProjects } from './listProjects.js'

export type SerializedSync = Omit<Sync, 'projectIds'> & {
	projectIds: string[]
}

export const getSync =
	(dbContext: DbContext) =>
	async (
		{ syncId }: { syncId: string },
		authContext: UserAuthContext,
	): Promise<{ sync: SerializedSync } | { error: ProblemDetail }> => {
		const maybeSync = await getSyncById(dbContext)(syncId)
		if ('error' in maybeSync) return { error: maybeSync.error }
		const { sync } = maybeSync
		// If user is not the owner, check if they have relevant projects in the sync
		if (sync.owner !== authContext.sub) {
			const maybeProjects = await listProjects(dbContext)(authContext)
			const userProjectIds = (
				'projects' in maybeProjects ? maybeProjects.projects : []
			).map(({ id }) => id)
			const userProjectIdsInSync = [...sync.projectIds].filter((id) =>
				userProjectIds.includes(id),
			)
			if (userProjectIdsInSync.length === 0)
				return {
					error: AccessDeniedError(`Access to sync ${syncId} denied.`),
				}

			return {
				sync: serialize({
					...sync,
					// Only show user the project IDs they have access to
					projectIds: new Set(userProjectIdsInSync),
				}),
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
})

export const getSyncById =
	({ db, TableName }: DbContext) =>
	async (id: string): Promise<{ sync: Sync } | { error: ProblemDetail }> => {
		const { Item } = await db.send(
			new GetItemCommand({
				TableName,
				Key: {
					id: {
						S: id,
					},
					type: {
						S: 'projectSync',
					},
				},
			}),
		)

		if (Item === undefined)
			return { error: NotFoundError(`Sync ${id} not found!`) }
		const sync = itemToSync(unmarshall(Item))
		return { sync }
	}
