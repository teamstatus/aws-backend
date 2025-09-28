import { PublishCommand, type SNSClient } from '@aws-sdk/client-sns'
import type { CoreEvent } from '../core/CoreEvent.tsx'
import { CoreEventType } from '../core/CoreEventType.ts'
import type { onFn } from '../core/notifier.ts'
import type { OrganizationCreatedEvent } from '../core/persistence/createOrganization.ts'
import type { ProjectCreatedEvent } from '../core/persistence/createProject.ts'
import type { UserCreatedEvent } from '../core/persistence/createUser.ts'

export const snsNotifier =
	({ sns, topicArn }: { sns: SNSClient; topicArn: string }) =>
	({ on }: { on: onFn }): void => {
		on('*', async (event, replay) => {
			if (replay) {
				return
			}
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
