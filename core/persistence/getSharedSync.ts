import { type DbContext } from './DbContext.js'
import type { Sync } from './createSync.js'
import { AccessDeniedError, type ProblemDetail } from '../ProblemDetail.js'
import { getSyncById, serialize } from './getSync.js'

export type SerializedSync = Omit<Sync, 'projectIds'> & {
	projectIds: string[]
}

export const getSharedSync =
	(dbContext: DbContext) =>
	async ({
		syncId,
		sharingToken,
	}: {
		syncId: string
		sharingToken?: string
	}): Promise<{ sync: SerializedSync } | { error: ProblemDetail }> => {
		const maybeSync = await getSyncById(dbContext)(syncId)
		if ('error' in maybeSync) return { error: maybeSync.error }
		const { sync } = maybeSync
		if (sync.sharingToken === undefined || sharingToken !== sync.sharingToken) {
			return {
				error: AccessDeniedError(`Access to sync ${syncId} denied.`),
			}
		}

		return { sync: serialize(sync) }
	}
