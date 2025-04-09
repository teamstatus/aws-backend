import {
	ConditionalCheckFailedException,
	PutItemCommand,
} from '@aws-sdk/client-dynamodb'
import type { CoreEvent } from '../CoreEvent.ts'
import { CoreEventType } from '../CoreEventType.ts'
import {
	BadRequestError,
	InternalError,
	type ProblemDetail,
} from '../ProblemDetail.ts'
import { Role } from '../Role.ts'
import type { UserAuthContext } from '../auth.ts'
import { isOrganizationId } from '../ids.ts'
import type { Notify } from '../notifier.ts'
import type { DbContext } from './DbContext.ts'
import { l } from './l.ts'

export type Organization = { id: string; name: string }

export type OrganizationCreatedEvent = CoreEvent & {
	type: CoreEventType.ORGANIZATION_CREATED
	id: string
	owner: string
	name: string
}

export const createOrganization =
	(dbContext: DbContext, notify: Notify) =>
	async (
		{ id: organizationId, name }: { id: string; name: string },
		authContext: UserAuthContext,
	): Promise<{ error: ProblemDetail } | Record<string, never>> => {
		const { sub: userId } = authContext
		if (!isOrganizationId(organizationId)) {
			return {
				error: BadRequestError(`Not an organization ID: ${organizationId}`),
			}
		}
		try {
			const { db, TableName } = dbContext
			await db.send(
				new PutItemCommand({
					TableName,
					Item: {
						id: {
							S: l(organizationId),
						},
						type: {
							S: 'organization',
						},
						name: {
							S: name,
						},
						version: {
							N: `1`,
						},
					},
					ConditionExpression: 'attribute_not_exists(id)',
				}),
			)
			await db.send(
				new PutItemCommand({
					TableName,
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
			const event: OrganizationCreatedEvent = {
				type: CoreEventType.ORGANIZATION_CREATED,
				owner: userId,
				id: organizationId,
				name,
				timestamp: new Date(),
			}
			await notify(event)
			return {}
		} catch (error) {
			if ((error as Error).name === ConditionalCheckFailedException.name) {
				return {
					error: BadRequestError(
						`Organization '${organizationId}' already exists.`,
					),
				}
			}
			return { error: InternalError() }
		}
	}
