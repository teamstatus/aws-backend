import {
	AttributeValue,
	QueryCommand,
	type QueryCommandInput,
} from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { ulid } from 'ulid'
import { BadRequestError, type ProblemDetail } from '../ProblemDetail.js'
import type { UserAuthContext } from '../auth.js'
import { type DbContext } from './DbContext.js'
import type { Status } from './createStatus.js'
import { canReadProjectStatus } from './getProjectMember.js'
import { getStatusReactions } from './getStatusReactions.js'
import { l } from './l.js'

export const listStatus =
	(dbContext: DbContext) =>
	async (
		{
			projectId,
			inclusiveStartDate,
			inclusiveEndDate,
			startKey,
		}: {
			projectId: string
			inclusiveStartDate?: Date
			inclusiveEndDate?: Date
			startKey?: string
		},
		authContext: UserAuthContext,
	): Promise<
		{ status: Status[]; nextStartKey?: string } | { error: ProblemDetail }
	> => {
		const { sub: userId } = authContext
		if (!(await canReadProjectStatus(dbContext)(projectId, userId))) {
			return {
				error: BadRequestError(
					`Only members of '${projectId}' are allowed to list status.`,
				),
			}
		}

		const { db, TableName } = dbContext

		const KeyConditionExpression = ['#project = :project']
		if (inclusiveStartDate !== undefined && inclusiveEndDate !== undefined) {
			KeyConditionExpression.push(
				'#id BETWEEN :inclusiveStartDate AND :inclusiveEndDate',
			)
		} else if (inclusiveStartDate !== undefined) {
			KeyConditionExpression.push('#id >= :inclusiveStartDate')
		} else if (inclusiveEndDate !== undefined) {
			KeyConditionExpression.push('#id <= :inclusiveEndDate')
		}
		const args: QueryCommandInput = {
			TableName,
			IndexName: 'projectStatus',
			KeyConditionExpression: KeyConditionExpression.join(' AND '),
			ExpressionAttributeNames: {
				'#project': 'projectStatus__project',
				...(inclusiveStartDate !== undefined || inclusiveEndDate !== undefined
					? { '#id': 'id' }
					: {}),
			},
			ExpressionAttributeValues: {
				':project': {
					S: l(projectId),
				},
				...(inclusiveStartDate !== undefined
					? {
							':inclusiveStartDate': {
								S: ulid(inclusiveStartDate.getTime()),
							},
					  }
					: {}),
				...(inclusiveEndDate !== undefined
					? {
							':inclusiveEndDate': {
								S: ulid(inclusiveEndDate.getTime()),
							},
					  }
					: {}),
			},
			ScanIndexForward: false,
			Limit: 25,
			ExclusiveStartKey:
				startKey === undefined
					? undefined
					: JSON.parse(Buffer.from(startKey, 'base64url').toString('utf-8')),
		}

		const res = await db.send(new QueryCommand(args))
		return {
			status: await Promise.all((res.Items ?? []).map(itemToStatus(dbContext))),
			nextStartKey:
				res.LastEvaluatedKey === undefined
					? undefined
					: Buffer.from(JSON.stringify(res.LastEvaluatedKey), 'utf-8').toString(
							'base64url',
					  ),
		}
	}

export const itemToStatus =
	({ db, TableName }: DbContext) =>
	async (item: Record<string, AttributeValue>): Promise<Status> => {
		const d = unmarshall(item)
		return {
			project: d.projectStatus__project,
			author: d.author,
			message: d.message,
			id: d.id,
			version: d.version,
			reactions: await getStatusReactions({
				db,
				TableName,
			})(d.id),
		}
	}
