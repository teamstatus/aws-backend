import {
	ConditionalCheckFailedException,
	UpdateItemCommand,
} from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import type { UserAuthContext } from '../auth.ts'
import type { CoreEvent } from '../CoreEvent.ts'
import { CoreEventType } from '../CoreEventType.ts'
import type { Notify } from '../notifier.ts'
import {
	BadRequestError,
	ConflictError,
	InternalError,
	type ProblemDetail,
} from '../ProblemDetail.ts'
import type { Organization } from './createOrganization.ts'
import type { DbContext } from './DbContext.ts'
import { isOrganizationOwner } from './getOrganizationMember.ts'

export type OrganizationUpdatedEvent = CoreEvent & {
	type: CoreEventType.ORGANIZATION_UPDATED
	version: number
} & Organization

export const updateOrganization =
	(dbContext: DbContext, notify: Notify) =>
	async (
		organizationId: string,
		update: Pick<Organization, 'name'>,
		version: number,
		authContext: UserAuthContext,
	): Promise<{ error: ProblemDetail } | Record<string, never>> => {
		try {
			const { sub: userId } = authContext

			if (!(await isOrganizationOwner(dbContext)(organizationId, userId))) {
				return {
					error: BadRequestError(
						`Only owners of ${organizationId} can update the organization.`,
					),
				}
			}

			const { db, TableName } = dbContext
			const { Attributes } = await db.send(
				new UpdateItemCommand({
					TableName,
					Key: {
						id: {
							S: organizationId,
						},
						type: {
							S: 'organization',
						},
					},
					UpdateExpression: 'SET #name = :name, #version = :newVersion',
					ConditionExpression: '#version = :version',
					ExpressionAttributeNames: {
						'#name': 'name',
						'#version': 'version',
					},
					ExpressionAttributeValues: {
						':name': {
							S: update.name,
						},
						':version': {
							N: `${version}`,
						},
						':newVersion': {
							N: `${version + 1}`,
						},
					},
					ReturnValues: 'ALL_NEW',
				}),
			)
			if (Attributes === undefined) {
				return { error: ConflictError('Update failed.') }
			}
			const updated = unmarshall(Attributes)
			const event: OrganizationUpdatedEvent = {
				type: CoreEventType.ORGANIZATION_UPDATED,
				id: organizationId,
				name: update.name,
				version: updated.version,
				timestamp: new Date(),
			}
			await notify(event)
			return {}
		} catch (error) {
			if ((error as Error).name === ConditionalCheckFailedException.name) {
				return {
					error: ConflictError(`Failed to update organization.`),
				}
			}
			return { error: InternalError() }
		}
	}
