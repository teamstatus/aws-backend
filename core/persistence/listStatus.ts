import { QueryCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { l, type AuthContext, type DbContext } from '../core.js'
import { parseProjectId } from '../ids.js'
import type { PersistedStatus } from './createStatus.js'
import { isOrganizationMember } from './getOrganizationMember.js'
import { getStatusReactions } from './getStatusReactions.js'

export const listStatus =
	(dbContext: DbContext) =>
	async (
		projectId: string,
		{ userId }: AuthContext,
	): Promise<{ status: PersistedStatus[] } | { error: Error }> => {
		const { organization } = parseProjectId(projectId)

		if (organization === null) {
			return {
				error: new Error(`Not a valid project ID: ${projectId}`),
			}
		}

		if (!(await isOrganizationMember(dbContext)(organization, userId))) {
			return {
				error: new Error(
					`Only members of '${organization}' are allowed to list status.`,
				),
			}
		}

		const { db, table } = dbContext

		const res = await db.send(
			new QueryCommand({
				TableName: table,
				IndexName: 'projectStatus',
				KeyConditionExpression: '#project = :project',
				ExpressionAttributeNames: {
					'#project': 'projectStatus__project',
				},
				ExpressionAttributeValues: {
					':project': {
						S: l(projectId),
					},
				},
				ScanIndexForward: false,
			}),
		)
		return {
			status: await Promise.all(
				(res.Items ?? []).map(async (item) => {
					const d = unmarshall(item)
					return {
						project: d.projectStatus__project,
						author: d.author,
						message: d.message,
						id: d.id,
						version: d.version,
						reactions: await getStatusReactions({
							db,
							TableName: table,
						})(d.id),
					}
				}),
			),
		}
	}
