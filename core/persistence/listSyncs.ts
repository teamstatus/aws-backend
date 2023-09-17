import { BatchGetItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { decodeTime } from 'ulid'
import { type ProblemDetail } from '../ProblemDetail.js'
import type { UserAuthContext } from '../auth.js'
import { type DbContext } from './DbContext.js'
import { itemToSync, serialize, type SerializedSync } from './getSync.js'
import { l } from './l.js'
import { listProjects } from './listProjects.js'

export const listSyncs =
	(dbContext: DbContext) =>
	async (
		authContext: UserAuthContext,
	): Promise<{ error: ProblemDetail } | { syncs: SerializedSync[] }> => {
		const ownerSyncs = await getSyncsByOwnerRole(dbContext, authContext)
		const projectSyncs = await getSyncsByProjectMembers(dbContext, authContext)
		const allSyncs = [...new Set([...ownerSyncs, ...projectSyncs])]

		// FIXME: add pagination
		const ids = allSyncs
			// only show syncs of the last 30 days
			.filter((id) => Date.now() - decodeTime(id) < 30 * 24 * 60 * 60 * 1000)
			.sort((a, b) => b.localeCompare(a))
			.slice(0, 25)

		if (ids.length === 0) return { syncs: [] }

		const { db, TableName } = dbContext
		const { Responses } = await db.send(
			new BatchGetItemCommand({
				RequestItems: {
					[TableName]: {
						Keys: ids.map((id) => ({
							id: { S: id },
							type: {
								S: 'projectSync',
							},
						})),
					},
				},
			}),
		)

		return {
			syncs: (Responses?.[TableName] ?? [])
				.map((Item) => itemToSync(unmarshall(Item)))
				.sort((s1, s2) => decodeTime(s2.id) - decodeTime(s1.id))
				.map(serialize),
		}
	}

const getSyncsByOwnerRole = async (
	dbContext: DbContext,
	authContext: UserAuthContext,
): Promise<string[]> => {
	const { db, TableName } = dbContext
	const { sub: userId } = authContext
	const { Items } = await db.send(
		new QueryCommand({
			TableName,
			IndexName: 'syncOwner',
			KeyConditionExpression: '#owner = :user',
			ExpressionAttributeNames: {
				'#id': 'id',
				'#owner': 'sync__owner',
			},
			ExpressionAttributeValues: {
				':user': {
					S: l(userId),
				},
			},
			ProjectionExpression: '#id',
		}),
	)

	return (Items ?? []).map((item) => unmarshall(item)).map(({ id }) => id)
}

const getSyncsByProjectMembers = async (
	dbContext: DbContext,
	authContext: UserAuthContext,
): Promise<string[]> => {
	const projects = await listProjects(dbContext)(authContext)
	if ('error' in projects) return []

	const { db, TableName } = dbContext
	const res = await Promise.all(
		projects.projects.map(({ id }) =>
			db.send(
				new QueryCommand({
					TableName,
					IndexName: 'projectSyncProject',
					KeyConditionExpression: '#project = :project',
					ExpressionAttributeNames: {
						'#id': 'id',
						'#project': 'sync__project',
					},
					ExpressionAttributeValues: {
						':project': {
							S: l(id),
						},
					},
					ProjectionExpression: '#id',
				}),
			),
		),
	)

	return res.flatMap(({ Items }) =>
		(Items ?? []).map((Item) => unmarshall(Item)).map(({ id }) => id),
	)
}
