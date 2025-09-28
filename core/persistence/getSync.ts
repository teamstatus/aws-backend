import { GetItemCommand } from '@aws-sdk/client-dynamodb'
import { type NativeAttributeValue, unmarshall } from '@aws-sdk/util-dynamodb'
import type { UserAuthContext } from '../auth.ts'
import {
	AccessDeniedError,
	NotFoundError,
	type ProblemDetail,
} from '../ProblemDetail.ts'
import type { Sync } from './createSync.ts'
import type { DbContext } from './DbContext.ts'
import { listProjects } from './listProjects.ts'

export type SerializedSync = Omit<Sync, 'projectIds'> & {
	projectIds: string[]
}

export const getSync =
	(dbContext: DbContext) =>
	async (
		syncId: string,
		authContext: UserAuthContext,
	): Promise<{ sync: SerializedSync } | { error: ProblemDetail }> => {
		const maybeSync = await getSyncById(dbContext)(syncId)
		if ('error' in maybeSync) {
			return maybeSync
		}
		const { sync } = maybeSync
		const maybeProjectIds = await projectsInSyncForUser(dbContext)(
			sync,
			authContext,
		)
		if ('error' in maybeProjectIds) {
			return maybeProjectIds
		}
		return {
			sync: serialize({
				...sync,
				// Only show user the project IDs they have access to
				projectIds: maybeProjectIds.projectIds,
			}),
		}
	}

export const serialize = (sync: Sync): SerializedSync => ({
	...sync,
	projectIds: [...sync.projectIds],
})

export const itemToSync = (
	sync: Record<string, NativeAttributeValue>,
): Sync => ({
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

		if (Item === undefined) {
			return { error: NotFoundError(`Sync ${id} not found!`) }
		}
		const sync = itemToSync(unmarshall(Item))
		return { sync }
	}

/**
 * Note: the check is done for all users (even the owner), because they may no longer be member of the project.
 */
export const projectsInSyncForUser =
	(dbContext: DbContext) =>
	async (
		sync: Sync,
		authContext: UserAuthContext,
	): Promise<{ error: ProblemDetail } | { projectIds: Set<string> }> => {
		const maybeProjects = await listProjects(dbContext)(authContext)
		const userProjectIds = (
			'projects' in maybeProjects ? maybeProjects.projects : []
		).map(({ id }) => id)
		const userProjectIdsInSync = [...sync.projectIds].filter((id) =>
			userProjectIds.includes(id),
		)
		if (userProjectIdsInSync.length === 0) {
			return {
				error: AccessDeniedError(
					`Access to sync ${sync.id} denied.`,
					`Only members of the organizations referenced in this sync have access. Ask the owner of this sync (${sync.owner}) to invite you to the relevant projects.`,
				),
			}
		}

		return { projectIds: new Set(userProjectIdsInSync) }
	}
