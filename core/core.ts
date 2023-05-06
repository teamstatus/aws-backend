import {
	DynamoDBClient,
	PutItemCommand,
	QueryCommand,
} from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { ulid } from 'ulid'
import { isOrganizationId, isProjectId, isUserId } from './ids'

export enum CoreEventType {
	ORGANIZATION_CREATED = 'ORGANIZATION_CREATED',
	PROJECT_CREATED = 'PROJECT_CREATED',
	STATUS_CREATED = 'STATUS_CREATED',
}
export type CoreEvent =
	| {
			type: CoreEventType.ORGANIZATION_CREATED
			id: string
			owner: string
	  }
	| {
			type: CoreEventType.PROJECT_CREATED
			id: string
			owner: string
	  }
	| {
			type: CoreEventType.STATUS_CREATED
			id: string
			author: string
			message: string
			project: string
	  }
type listenerFn = (event: CoreEvent) => unknown
const l = (s: string) => s.toLowerCase()
export const core = ({ db, table }: { db: DynamoDBClient; table: string }) => {
	const listeners: { event: CoreEventType | '*'; fn: listenerFn }[] = []
	const notify = (event: CoreEvent) => {
		for (const { fn } of [
			...listeners.filter(({ event }) => event === '*'),
			...listeners.filter(({ event: e }) => e === event.type),
		]) {
			fn(event)
		}
	}
	return {
		authenticate: (userId: string) => ({
			organizations: {
				create: async (organizationId: string) => {
					if (!isOrganizationId(organizationId))
						return {
							error: new Error(`Not an organization ID: ${organizationId}`),
						}
					const organizationIdKey = l(organizationId)
					if (!isUserId(userId)) {
						return {
							error: new Error(`Not a valid user ID: ${userId}`),
						}
					}
					const userIdKey = l(userId)
					await db.send(
						new PutItemCommand({
							TableName: table,
							Item: {
								id: {
									S: organizationIdKey,
								},
								type: {
									S: 'organization',
								},
							},
						}),
					)
					await db.send(
						new PutItemCommand({
							TableName: table,
							Item: {
								id: {
									S: ulid(),
								},
								type: {
									S: 'organizationMember',
								},
								organizationMember__organization: {
									S: organizationIdKey,
								},
								organizationMember__user: {
									S: userIdKey,
								},
								role: {
									S: 'owner',
								},
							},
						}),
					)
					const event: CoreEvent = {
						type: CoreEventType.ORGANIZATION_CREATED,
						id: organizationId,
						owner: userId,
					}
					notify(event)
					return { organization: event }
				},
				list: async () => {
					if (!isUserId(userId)) {
						return {
							error: new Error(`Not a valid user ID: ${userId}`),
						}
					}
					const userIdKey = l(userId)
					const res = await db.send(
						new QueryCommand({
							TableName: table,
							IndexName: 'memberOrganizations',
							KeyConditionExpression: '#user = :user',
							ExpressionAttributeNames: {
								'#user': 'organizationMember__user',
							},
							ExpressionAttributeValues: {
								':user': {
									S: userIdKey,
								},
							},
						}),
					)
					return {
						organizations: await Promise.all(
							(res.Items ?? []).map((item) => {
								const d: {
									organizationMember__organization: string // '$acme',
									role: 'owner'
									id: string // '01GZQ0QH3BQF9W3JQXTDHGB251',
									organizationMember__user: string //'@alex'
								} = unmarshall(item) as any
								return {
									id: d.organizationMember__organization,
									role: d.role,
								}
							}),
						),
					}
				},
			},
			organization: (organizationId: string) => ({
				projects: {
					// FIXME: check write permission
					create: async (projectId: string) => {
						if (!isUserId(userId)) {
							return {
								error: new Error(`Not a valid user ID: ${userId}`),
							}
						}
						const userIdKey = l(userId)

						const organizationProjectId = l(`${organizationId}${projectId}`)

						if (!isProjectId(organizationProjectId)) {
							return {
								error: new Error(
									`Not a valid project ID: ${organizationProjectId}`,
								),
							}
						}

						await db.send(
							new PutItemCommand({
								TableName: table,
								Item: {
									id: {
										S: organizationProjectId,
									},
									type: {
										S: 'project',
									},
								},
							}),
						)
						await db.send(
							new PutItemCommand({
								TableName: table,
								Item: {
									id: {
										S: ulid(),
									},
									type: {
										S: 'projectMember',
									},
									projectMember__project: {
										S: organizationProjectId,
									},
									projectMember__user: {
										S: userIdKey,
									},
									role: {
										S: 'owner',
									},
								},
							}),
						)
						const event: CoreEvent = {
							type: CoreEventType.PROJECT_CREATED,
							id: organizationProjectId,
							owner: userId,
						}
						notify(event)
						return { project: event }
					},
					list: async () => {
						if (!isUserId(userId)) {
							return {
								error: new Error(`Not a valid user ID: ${userId}`),
							}
						}
						const userIdKey = l(userId)

						// TODO: Check permission
						const res = await db.send(
							new QueryCommand({
								TableName: table,
								IndexName: 'memberProjects',
								KeyConditionExpression: '#user = :user',
								ExpressionAttributeNames: {
									'#user': 'projectMember__user',
								},
								ExpressionAttributeValues: {
									':user': {
										S: userIdKey,
									},
								},
							}),
						)
						return {
							projects: await Promise.all(
								(res.Items ?? []).map((item) => {
									const d: {
										projectMember__project: string // '#teamstatus',
										role: 'owner'
										id: string // '01GZQ0QH3BQF9W3JQXTDHGB251',
										projectMember__user: string //'@alex'
									} = unmarshall(item) as any
									return {
										id: d.projectMember__project,
										role: d.role,
									}
								}),
							),
						}
					},
				},
				project: (projectId: string) => ({
					status: {
						// FIXME: check write permission
						create: async (message: string) => {
							if (!isUserId(userId)) {
								return {
									error: new Error(`Not a valid user ID: ${userId}`),
								}
							}
							const userIdKey = l(userId)

							const organizationProjectId = l(`${organizationId}${projectId}`)
							if (!isProjectId(organizationProjectId)) {
								return {
									error: new Error(
										`Not a valid project ID: ${organizationProjectId}`,
									),
								}
							}

							// TODO: Check permission
							const id = ulid()

							await db.send(
								new PutItemCommand({
									TableName: table,
									Item: {
										id: {
											S: id,
										},
										type: {
											S: 'status',
										},
										status__project: {
											S: organizationProjectId,
										},
										status__author: {
											S: userIdKey,
										},
										status__message: {
											S: message,
										},
									},
								}),
							)
							const event: CoreEvent = {
								type: CoreEventType.STATUS_CREATED,
								message,
								author: userId,
								id,
								project: organizationProjectId,
							}
							notify(event)
							return { status: event }
						},
						list: async () => {
							if (!isUserId(userId)) {
								return {
									error: new Error(`Not a valid user ID: ${userId}`),
								}
							}
							const userIdKey = l(userId)

							const organizationProjectId = l(`${organizationId}${projectId}`)
							if (!isProjectId(organizationProjectId)) {
								return {
									error: new Error(
										`Not a valid project ID: ${organizationProjectId}`,
									),
								}
							}

							// TODO: Check permission
							const res = await db.send(
								new QueryCommand({
									TableName: table,
									IndexName: 'projectStatus',
									KeyConditionExpression: '#project = :project',
									ExpressionAttributeNames: {
										'#project': 'status__project',
									},
									ExpressionAttributeValues: {
										':project': {
											S: organizationProjectId,
										},
									},
									ScanIndexForward: false,
								}),
							)
							return {
								status: await Promise.all(
									(res.Items ?? []).map((item) => {
										const d: {
											status__project: string // '#teamstatus',
											status__author: string // '@alex'
											id: string // '01GZQ0QH3BQF9W3JQXTDHGB251',
											status__message: string
										} = unmarshall(item) as any
										return {
											project: d.status__project,
											role:
												d.status__author === userIdKey ? 'author' : undefined,
											author: d.status__author,
											message: d.status__message,
											id: d.id,
										}
									}),
								),
							}
						},
					},
				}),
			}),
		}),
		on: (event: CoreEventType | '*', fn: listenerFn) => {
			listeners.push({ event, fn })
		},
	}
}
