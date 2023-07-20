import { SNSClient, PublishCommand } from '@aws-sdk/client-sns'
import type { onFn } from '../core/notifier'
import { CoreEventType } from '../core/CoreEventType.js'
import type { CoreEvent } from '../core/CoreEvent'
import type { UserCreatedEvent } from '../core/persistence/createUser'
import type { OrganizationCreatedEvent } from '../core/persistence/createOrganization'
import type { ProjectCreatedEvent } from '../core/persistence/createProject'

export const snsNotifier =
	({ sns, topicArn }: { sns: SNSClient; topicArn: string }) =>
	({ on }: { on: onFn }): void => {
		on('*', async (event) => {
			if (
				isUserCreatedEvent(event) ||
				isOrganizationCreatedEvent(event) ||
				isProjectCreatedEvent(event) ||
				isSyncCreatedEvent(event)
			) {
				await sns.send(
					new PublishCommand({
						TopicArn: topicArn,
						MessageAttributes: {
							type: {
								DataType: 'String',
								StringValue: event.type,
							},
							timestamp: {
								DataType: 'String',
								StringValue: event.timestamp.toISOString(),
							},
						},
						Message: JSON.stringify(event),
					}),
				)
				console.log({ snsNotifier: JSON.stringify(event) })
			}
		})
	}

const isUserCreatedEvent = (e: CoreEvent): e is UserCreatedEvent =>
	e.type === CoreEventType.USER_CREATED

const isOrganizationCreatedEvent = (
	e: CoreEvent,
): e is OrganizationCreatedEvent =>
	e.type === CoreEventType.ORGANIZATION_CREATED

const isProjectCreatedEvent = (e: CoreEvent): e is ProjectCreatedEvent =>
	e.type === CoreEventType.PROJECT_CREATED

const isSyncCreatedEvent = (e: CoreEvent): e is ProjectCreatedEvent =>
	e.type === CoreEventType.SYNC_CREATED
