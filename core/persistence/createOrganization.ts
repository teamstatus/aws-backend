import {
	ConditionalCheckFailedException,
	PutItemCommand,
} from '@aws-sdk/client-dynamodb'
import { ulid } from 'ulid'
import {
	CoreEventType,
	Role,
	l,
	type AuthContext,
	type CoreEvent,
	type DbContext,
	type Notify,
} from '../core.js'
import { isOrganizationId } from '../ids.js'

export type PersistedOrganization = { id: string; name: string | null }

export type OrganizationCreatedEvent = CoreEvent & {
	type: CoreEventType.ORGANIZATION_CREATED
	id: string
	owner: string
}

export const createOrganization =
	(dbContext: DbContext, notify: Notify) =>
	async (
		{ id: organizationId, name }: { id: string; name?: string },
		{ userId }: AuthContext,
	): Promise<{ error: Error } | { organization: PersistedOrganization }> => {
		if (!isOrganizationId(organizationId))
			return {
				error: new Error(`Not an organization ID: ${organizationId}`),
			}
		try {
			const { db, table } = dbContext
			await db.send(
				new PutItemCommand({
					TableName: table,
					Item: {
						id: {
							S: l(organizationId),
						},
						type: {
							S: 'organization',
						},
						name:
							name !== undefined
								? {
										S: name,
								  }
								: { NULL: true },
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
							S: l(organizationId),
						},
						organizationMember__user: {
							S: l(userId),
						},
						role: {
							S: Role.OWNER,
						},
					},
				}),
			)
			const org: PersistedOrganization = {
				id: organizationId,
				name: name ?? null,
			}
			const event: OrganizationCreatedEvent = {
				type: CoreEventType.ORGANIZATION_CREATED,
				owner: userId,
				...org,
			}
			notify(event)
			return { organization: org }
		} catch (error) {
			if ((error as Error).name === ConditionalCheckFailedException.name)
				return {
					error: new Error(`Organization '${organizationId}' already exists.`),
				}
			return { error: error as Error }
		}
	}
