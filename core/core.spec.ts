import {
	BillingMode,
	CreateTableCommand,
	DynamoDBClient,
	KeyType,
	ProjectionType,
	PutItemCommand,
	QueryCommand,
	ScalarAttributeType,
} from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { before, describe, test as it } from 'node:test'
import { check, objectMatching, stringMatching } from 'tsmatchers'
import { ulid } from 'ulid'
import { isOrganizationId, isProjectId, isUserId } from './ids'

enum CoreEventType {
	ORGANIZATION_CREATED = 'ORGANIZATION_CREATED',
	PROJECT_CREATED = 'PROJECT_CREATED',
	STATUS_CREATED = 'STATUS_CREATED',
}
type CoreEvent =
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

const core = ({ db, table }: { db: DynamoDBClient; table: string }) => {
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
								} = unmarshall(item)
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

						// TODO: Check permission
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
									} = unmarshall(item)
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
										} = unmarshall(item)
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

describe('core', async () => {
	const table = `teamstatus-${ulid()}`
	const db = new DynamoDBClient({
		endpoint: 'http://localhost:8000/',
		region: 'eu-west-1',
	})
	const coreInstance = core({ db, table })

	before(async () => {
		try {
			await db.send(
				new CreateTableCommand({
					TableName: table,
					KeySchema: [
						{
							AttributeName: 'id',
							KeyType: KeyType.HASH,
						},
						{
							AttributeName: 'type',
							KeyType: KeyType.RANGE,
						},
					],
					AttributeDefinitions: [
						{
							AttributeName: 'id',
							AttributeType: ScalarAttributeType.S,
						},
						{
							AttributeName: 'type',
							AttributeType: ScalarAttributeType.S,
						},
						{
							AttributeName: 'organizationMember__organization',
							AttributeType: ScalarAttributeType.S,
						},
						{
							AttributeName: 'organizationMember__user',
							AttributeType: ScalarAttributeType.S,
						},
						{
							AttributeName: 'projectMember__project',
							AttributeType: ScalarAttributeType.S,
						},
						{
							AttributeName: 'projectMember__user',
							AttributeType: ScalarAttributeType.S,
						},
						{
							AttributeName: 'status__project',
							AttributeType: ScalarAttributeType.S,
						},
						{
							AttributeName: 'status__author',
							AttributeType: ScalarAttributeType.S,
						},
					],
					BillingMode: BillingMode.PAY_PER_REQUEST,
					GlobalSecondaryIndexes: [
						{
							IndexName: 'memberOrganizations',
							KeySchema: [
								{
									AttributeName: 'organizationMember__user',
									KeyType: KeyType.HASH,
								},
								{
									AttributeName: 'organizationMember__organization',
									KeyType: KeyType.RANGE,
								},
							],
							Projection: {
								ProjectionType: ProjectionType.INCLUDE,
								NonKeyAttributes: ['role', 'id'],
							},
						},
						{
							IndexName: 'memberProjects',
							KeySchema: [
								{
									AttributeName: 'projectMember__user',
									KeyType: KeyType.HASH,
								},
								{
									AttributeName: 'projectMember__project',
									KeyType: KeyType.RANGE,
								},
							],
							Projection: {
								ProjectionType: ProjectionType.INCLUDE,
								NonKeyAttributes: ['role', 'id'],
							},
						},
						{
							IndexName: 'projectStatus',
							KeySchema: [
								{
									AttributeName: 'status__project',
									KeyType: KeyType.HASH,
								},
								{
									AttributeName: 'id',
									KeyType: KeyType.RANGE,
								},
							],
							Projection: {
								ProjectionType: ProjectionType.INCLUDE,
								NonKeyAttributes: ['status__author', 'status__message'],
							},
						},
					],
				}),
			)
		} catch (err) {
			console.error(`Failed to create table: ${(err as Error).message}!`)
			throw err
		}
		console.log(`Table ${table} created.`)
	})

	describe('organizations', async () => {
		it('can create a new organization', async () => {
			const events: CoreEvent[] = []
			coreInstance.on(CoreEventType.ORGANIZATION_CREATED, (e) => events.push(e))
			const { organization } = await coreInstance
				.authenticate('@alex')
				.organizations.create('$acme')
			check(organization).is(
				objectMatching({
					id: '$acme',
				}),
			)
			check(events[0]).is(
				objectMatching({
					type: CoreEventType.ORGANIZATION_CREATED,
					id: '$acme',
					owner: '@alex',
				}),
			)
		})
		it('can list organizations for a user', async () => {
			const { organizations } = await coreInstance
				.authenticate('@alex')
				.organizations.list()
			check(organizations?.[0]).is(
				objectMatching({
					id: '$acme',
					role: 'owner',
				}),
			)
		})
	})

	describe('projects', async () => {
		it('can create a new project', async () => {
			const events: CoreEvent[] = []
			coreInstance.on(CoreEventType.PROJECT_CREATED, (e) => events.push(e))

			const { project } = await coreInstance
				.authenticate('@alex')
				.organization('$acme')
				.projects.create('#teamstatus')

			check(project).is(
				objectMatching({
					id: '$acme#teamstatus',
				}),
			)
			check(events[0]).is(
				objectMatching({
					type: CoreEventType.PROJECT_CREATED,
					id: '$acme#teamstatus',
					owner: '@alex',
				}),
			)
		})

		it('can list projects for a user', async () => {
			const { projects } = await coreInstance
				.authenticate('@alex')
				.organization('$acme')
				.projects.list()
			check(projects?.[0]).is(
				objectMatching({
					id: '$acme#teamstatus',
					role: 'owner',
				}),
			)
		})
	})

	describe('status', async () => {
		it('can post a new status update', async () => {
			const events: CoreEvent[] = []
			coreInstance.on(CoreEventType.STATUS_CREATED, (e) => events.push(e))

			const { status } = await coreInstance
				.authenticate('@alex')
				.organization('$acme')
				.project('#teamstatus')
				.status.create(
					'Implemented ability to persist status updates for projects.',
				)

			check(status).is(
				objectMatching({
					project: '$acme#teamstatus',
					message:
						'Implemented ability to persist status updates for projects.',
					id: stringMatching(/[0-7][0-9A-HJKMNP-TV-Z]{25}/gm) as any,
				}),
			)
			check(events[0]).is(
				objectMatching({
					type: CoreEventType.STATUS_CREATED,
					project: '$acme#teamstatus',
					message:
						'Implemented ability to persist status updates for projects.',
					author: '@alex',
					id: stringMatching(/[0-7][0-9A-HJKMNP-TV-Z]{25}/gm) as any,
				}),
			)
		})

		it('can list status for a project', async () => {
			const { status } = await coreInstance
				.authenticate('@alex')
				.organization('$acme')
				.project('#teamstatus')
				.status.list()
			check(status?.[0]).is(
				objectMatching({
					id: stringMatching(/[0-7][0-9A-HJKMNP-TV-Z]{25}/gm) as any,
					message:
						'Implemented ability to persist status updates for projects.',
					author: '@alex',
					project: '$acme#teamstatus',
					role: 'author',
				}),
			)
		})
	})
})
