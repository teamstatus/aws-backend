import {
	ConditionalCheckFailedException,
	DeleteItemCommand,
	DynamoDBClient,
	GetItemCommand,
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
	PROJECT_MEMBER_INVITED = 'PROJECT_MEMBER_INVITED',
	PROJECT_MEMBER_CREATED = 'PROJECT_MEMBER_CREATED',
	REACTION_CREATED = 'REACTION_CREATED',
}
export enum Role {
	OWNER = 'owner',
	MEMBER = 'member',
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
	| {
			type: CoreEventType.PROJECT_MEMBER_INVITED
			id: string
			project: string
			inviter: string
			invitee: string
			role: Role
	  }
	| {
			type: CoreEventType.PROJECT_MEMBER_CREATED
			id: string
			project: string
			user: string
			role: Role
	  }
	| ({
			type: CoreEventType.REACTION_CREATED
			id: string
			status: string
			author: string
	  } & Reaction)
type listenerFn = (event: CoreEvent) => unknown
const l = (s: string) => s.toLowerCase()

export type PersistedStatus = {
	project: string
	author: string
	message: string
	id: string
	reactions: PersistedReaction[]
}

export type PersistedOrganization = { id: string }

// Reactions can have special roles
export enum ReactionRole {
	// A significant thing happened, makes the status stand out from others in the list of status
	SIGNIFICANT = 'SIGNIFICANT',
	// The status needs to be discussed during the next sync meeting, this will collect this status in a separate list of open questions during the next sync meeting
	QUESTION = 'QUESTION',
}

export type Reaction =
	| {
			role: ReactionRole
			emoji: string
			description: string
	  }
	| {
			emoji: string
			description?: string
	  }

type PersistedReaction = { id: string } & Reaction

export const bugFix: Reaction = {
	description: 'A bug was fixed',
	emoji: '🐞',
	role: ReactionRole.SIGNIFICANT,
}

export const newVersionRelease: Reaction = {
	description: 'A new version was released',
	emoji: '🚀',
	role: ReactionRole.SIGNIFICANT,
}

export const question: Reaction = {
	description: 'This item needs to be discussed during the next sync meeting',
	emoji: '🙋',
	role: ReactionRole.QUESTION,
}

export const praise: Reaction = {
	emoji: '🌟',
	description: 'This is amazing!',
}

export const thumbsUp = {
	emoji: '👍',
}

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
	const getOrganizationMember = async (
		organizationId: string,
		userId: string,
	) => {
		if (!isUserId(userId)) {
			return {
				error: new Error(`Not a valid user ID: ${userId}`),
			}
		}
		const userIdKey = l(userId)
		if (!isOrganizationId(organizationId)) {
			return {
				error: new Error(`Not a valid organization ID: ${organizationId}`),
			}
		}
		const organizationIdKey = l(organizationId)

		const res = await db.send(
			new QueryCommand({
				TableName: table,
				IndexName: 'organizationMember',
				KeyConditionExpression:
					'#user = :user AND #organization = :organization',
				ExpressionAttributeNames: {
					'#user': 'organizationMember__user',
					'#organization': 'organizationMember__organization',
				},
				ExpressionAttributeValues: {
					':user': {
						S: userIdKey,
					},
					':organization': {
						S: organizationIdKey,
					},
				},
				Limit: 1,
			}),
		)

		const memberInfo = res.Items?.[0]
		return memberInfo !== undefined ? unmarshall(memberInfo) : null
	}
	const isOrganizationMember = async (organizationId: string, userId: string) =>
		(await getOrganizationMember(organizationId, userId)) !== null
	const isOrganizationOwner = async (organizationId: string, userId: string) =>
		(await getOrganizationMember(organizationId, userId))?.role === Role.OWNER

	const getProjectMember = async (projectId: string, userId: string) => {
		if (!isUserId(userId)) {
			return {
				error: new Error(`Not a valid user ID: ${userId}`),
			}
		}
		const userIdKey = l(userId)
		if (!isProjectId(projectId)) {
			return {
				error: new Error(`Not a valid project ID: ${projectId}`),
			}
		}
		const projectIdKey = l(projectId)

		const res = await db.send(
			new QueryCommand({
				TableName: table,
				IndexName: 'projectMember',
				KeyConditionExpression: '#user = :user AND #project = :project',
				ExpressionAttributeNames: {
					'#user': 'projectMember__user',
					'#project': 'projectMember__project',
				},
				ExpressionAttributeValues: {
					':user': {
						S: userIdKey,
					},
					':project': {
						S: projectIdKey,
					},
				},
				Limit: 1,
			}),
		)

		const memberInfo = res.Items?.[0]
		return memberInfo !== undefined ? unmarshall(memberInfo) : null
	}
	const isProjectMember = async (projectId: string, userId: string) =>
		(await getProjectMember(projectId, userId)) !== null

	const createProjectMember = async (
		organizationProjectId: string,
		userIdKey: string,
		role: Role,
	): Promise<CoreEvent> => {
		const id = ulid()
		await db.send(
			new PutItemCommand({
				TableName: table,
				Item: {
					id: {
						S: id,
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
						S: role,
					},
				},
			}),
		)
		return {
			type: CoreEventType.PROJECT_MEMBER_CREATED,
			id,
			project: organizationProjectId,
			user: userIdKey,
			role,
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
					try {
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
								ConditionExpression: 'attribute_not_exists(id)',
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
										S: Role.OWNER,
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
					} catch (error) {
						if ((error as Error).name === ConditionalCheckFailedException.name)
							return {
								error: new Error(
									`Organization '${organizationIdKey}' already exists.`,
								),
							}
						return { error: error as Error }
					}
				},
				list: async (): Promise<
					{ error: Error } | { organizations: PersistedOrganization[] }
				> => {
					if (!isUserId(userId)) {
						return {
							error: new Error(`Not a valid user ID: ${userId}`),
						}
					}
					const userIdKey = l(userId)
					const res = await db.send(
						new QueryCommand({
							TableName: table,
							IndexName: 'organizationMember',
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
									id: string // '01GZQ0QH3BQF9W3JQXTDHGB251',
									organizationMember__user: string //'@alex'
								} = unmarshall(item) as any
								return {
									id: d.organizationMember__organization,
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

						if (!(await isOrganizationMember(organizationId, userId))) {
							return {
								error: new Error(
									`Only members of ${organizationId} can create new projects.`,
								),
							}
						}
						try {
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
									ConditionExpression: 'attribute_not_exists(id)',
								}),
							)
							const event: CoreEvent = {
								type: CoreEventType.PROJECT_CREATED,
								id: organizationProjectId,
								owner: userId,
							}
							notify(event)

							const memberEvent = await createProjectMember(
								organizationProjectId,
								userIdKey,
								Role.OWNER,
							)

							notify(memberEvent)

							return { project: event }
						} catch (error) {
							if (
								(error as Error).name === ConditionalCheckFailedException.name
							)
								return {
									error: new Error(
										`Project '${organizationProjectId}' already exists.`,
									),
								}
							return { error: error as Error }
						}
					},
					list: async () => {
						if (!isUserId(userId)) {
							return {
								error: new Error(`Not a valid user ID: ${userId}`),
							}
						}
						const userIdKey = l(userId)

						if (!(await isOrganizationMember(organizationId, userId))) {
							return {
								error: new Error(
									`Only members of ${organizationId} can view projects.`,
								),
							}
						}

						const res = await db.send(
							new QueryCommand({
								TableName: table,
								IndexName: 'projectMember',
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
										role: Role.OWNER
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

							if (!(await isProjectMember(organizationProjectId, userId))) {
								return {
									error: new Error(
										`Only members of '${organizationProjectId}' are allowed to create status.`,
									),
								}
							}

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
						list: async (): Promise<
							{ status: PersistedStatus[] } | { error: Error }
						> => {
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

							if (!(await isOrganizationMember(organizationId, userIdKey))) {
								return {
									error: new Error(
										`Only members of '${organizationId}' are allowed to list status.`,
									),
								}
							}

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
									(res.Items ?? []).map(async (item) => {
										const d: {
											status__project: string // '#teamstatus',
											status__author: string // '@alex'
											id: string // '01GZQ0QH3BQF9W3JQXTDHGB251',
											status__message: string
										} = unmarshall(item) as any
										return {
											project: d.status__project,
											author: d.status__author,
											message: d.status__message,
											id: d.id,
											reactions: await getStatusReactions({
												db,
												TableName: table,
											})(d.id),
										}
									}),
								),
							}
						},
					},
					invite: async (invitedUserId: string) => {
						if (!isUserId(userId)) {
							return {
								error: new Error(`Not a valid user ID: ${userId}`),
							}
						}
						const userIdKey = l(userId)

						if (!isUserId(invitedUserId)) {
							return {
								error: new Error(`Not a valid user ID: ${invitedUserId}`),
							}
						}
						const invitedUserIdKey = l(invitedUserId)

						const organizationProjectId = l(`${organizationId}${projectId}`)
						if (!isProjectId(organizationProjectId)) {
							return {
								error: new Error(
									`Not a valid project ID: ${organizationProjectId}`,
								),
							}
						}

						if (!(await isOrganizationOwner(organizationId, userId))) {
							return {
								error: new Error(
									`Only members of ${organizationId} can view projects.`,
								),
							}
						}

						const id = ulid()

						await db.send(
							new PutItemCommand({
								TableName: table,
								Item: {
									id: {
										S: id,
									},
									type: {
										S: 'projectInvitation',
									},
									projectInvitation__project: {
										S: organizationProjectId,
									},
									projectInvitation__invitee: {
										S: invitedUserIdKey,
									},
									projectInvitation__inviter: {
										S: userIdKey,
									},
									projectInvitation__role: {
										S: Role.MEMBER,
									},
								},
							}),
						)
						const event: CoreEvent = {
							type: CoreEventType.PROJECT_MEMBER_INVITED,
							id,
							project: organizationProjectId,
							invitee: invitedUserIdKey,
							inviter: userIdKey,
							role: Role.MEMBER,
						}
						notify(event)
						return { invitation: event }
					},
					invitation: (invitationId: string) => ({
						accept: async () => {
							const { Item } = await db.send(
								new GetItemCommand({
									TableName: table,
									Key: {
										id: {
											S: invitationId,
										},
										type: {
											S: 'projectInvitation',
										},
									},
								}),
							)

							if (Item === undefined)
								return {
									error: new Error(`Invitation '${invitationId}' not found!`),
								}

							const invitation = unmarshall(Item)

							if (invitation.projectInvitation__invitee !== l(userId)) {
								return {
									error: new Error(
										`Invitation '${invitationId}' is not for you!`,
									),
								}
							}

							const [event] = await Promise.all([
								createProjectMember(
									invitation.projectInvitation__project,
									invitation.projectInvitation__invitee,
									invitation.projectInvitation__role,
								),
								db.send(
									new DeleteItemCommand({
										TableName: table,
										Key: {
											id: {
												S: invitationId,
											},
											type: {
												S: 'projectInvitation',
											},
										},
									}),
								),
							])

							notify(event)

							return {
								projectMembership: {
									id: event.id,
									role: invitation.projectInvitation__role,
								},
							}
						},
					}),
				}),
			}),
			// New API
			createReaction: async (statusId: string, reaction: Reaction) => {
				if (!isUserId(userId)) {
					return {
						error: new Error(`Not a valid user ID: ${userId}`),
					}
				}
				const userIdKey = l(userId)

				const { Item } = await db.send(
					new GetItemCommand({
						TableName: table,
						Key: {
							id: {
								S: statusId,
							},
							type: {
								S: 'status',
							},
						},
					}),
				)

				if (Item === undefined)
					return {
						error: `Status '${statusId}' not found!`,
					}

				const status = unmarshall(Item)
				if (status.status__author !== l(userId)) {
					return {
						error: `Only authors may add reactions for now!`,
					}
				}

				const id = ulid()

				await db.send(
					new PutItemCommand({
						TableName: table,
						Item: {
							id: {
								S: id,
							},
							type: {
								S: 'statusReaction',
							},
							statusReaction__status: {
								S: statusId,
							},
							author: {
								S: userIdKey,
							},
							emoji: {
								S: reaction.emoji,
							},
							role: 'role' in reaction ? { S: reaction.role } : { NULL: true },
							description:
								'description' in reaction && reaction.description !== undefined
									? { S: reaction.description }
									: { NULL: true },
						},
					}),
				)
				const event: CoreEvent = {
					type: CoreEventType.REACTION_CREATED,
					id,
					...reaction,
					author: userIdKey,
					status: statusId,
				}
				notify(event)
				return { reaction: event }
			},
		}),
		on: (event: CoreEventType | '*', fn: listenerFn) => {
			listeners.push({ event, fn })
		},
	}
}

const getStatusReactions =
	({ db, TableName }: { db: DynamoDBClient; TableName: string }) =>
	async (statusId: string): Promise<PersistedReaction[]> =>
		db
			.send(
				new QueryCommand({
					TableName,
					IndexName: 'statusReaction',
					KeyConditionExpression: '#status = :status',
					ExpressionAttributeNames: {
						'#status': 'statusReaction__status',
					},
					ExpressionAttributeValues: {
						':status': {
							S: statusId,
						},
					},
				}),
			)
			.then(
				({ Items }) =>
					Items?.map((i) => {
						const item = unmarshall(i)
						return {
							id: item.id,
							emoji: item.emoji,
							description: item.description,
							role: item.role,
							author: item.author,
						}
					}) ?? [],
			)
