import {
	ConditionalCheckFailedException,
	PutItemCommand,
} from '@aws-sdk/client-dynamodb'
import { type CoreEvent } from '../CoreEvent.js'
import { CoreEventType } from '../CoreEventType.js'
import {
	BadRequestError,
	InternalError,
	type ProblemDetail,
} from '../ProblemDetail.js'
import { Role } from '../Role.js'
import type { UserAuthContext } from '../auth.js'
import { isOrganizationId } from '../ids.js'
import type { Notify } from '../notifier.js'
import { type DbContext } from './DbContext.js'
import { l } from './l.js'

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
		authContext: UserAuthContext,
	): Promise<
		{ error: ProblemDetail } | { organization: PersistedOrganization }
	> => {
		const { sub: userId } = authContext
		if (!isOrganizationId(organizationId))
			return {
				error: BadRequestError(`Not an organization ID: ${organizationId}`),
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
							S: `${l(organizationId)}:${l(userId)}`,
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
				timestamp: new Date(),
			}
			notify(event)
			return { organization: org }
		} catch (error) {
			if ((error as Error).name === ConditionalCheckFailedException.name)
				return {
					error: BadRequestError(
						`Organization '${organizationId}' already exists.`,
					),
				}
			console.error((error as Error).message)
			return { error: InternalError() }
		}
	}
