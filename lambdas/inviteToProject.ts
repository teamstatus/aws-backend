import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb'
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { StatusCode } from '../core/StatusCode.js'
import { notifier } from '../core/notifier.js'
import type { DbContext } from '../core/persistence/DbContext.js'
import { inviteToProject } from '../core/persistence/inviteToProject.js'
import { l } from '../core/persistence/l.js'
import { userAuthRequestPipe } from './requestPipe.js'

const { TableName } = fromEnv({
	TableName: 'TABLE_NAME',
})(process.env)

const fromEmail = process.env.FROM_EMAIL ?? 'notification@teamstatus.space'

const ses = new SESClient({})
const db = new DynamoDBClient({})

const { notify } = notifier()
const invite = inviteToProject(
	{
		db,
		TableName,
	},
	notify,
)

type UserInfo = {
	id: string
	type: 'user'
	name?: string
	user__email: string
}
const getUser =
	({ db, TableName }: DbContext) =>
	async (id: string): Promise<null | UserInfo> =>
		db
			.send(
				new GetItemCommand({
					TableName,
					Key: {
						id: {
							S: l(id),
						},
						type: {
							S: 'user',
						},
					},
					ProjectionExpression: '#email, #name',
					ExpressionAttributeNames: {
						'#email': 'user__email',
						'#name': 'name',
					},
				}),
			)
			.then(({ Item }) =>
				Item !== undefined ? (unmarshall(Item) as UserInfo) : null,
			)
			.catch((err) => {
				console.error(err)
				return null
			})

export const handler = userAuthRequestPipe(
	(event) => {
		const { invitedUserId, role } = JSON.parse(event.body ?? '')
		return {
			invitedUserId,
			role,
			projectId: event.pathParameters?.projectId as string,
		}
	},
	async ({ invitedUserId, projectId, role }, authContext) => {
		const res = await invite({ invitedUserId, projectId, role }, authContext)
		if ('id' in res) {
			const [Invitee, Inviter] = await Promise.all([
				getUser({ db, TableName })(invitedUserId),
				getUser({ db, TableName })(authContext.sub),
			])

			const name = Invitee?.name
			const email = Invitee?.user__email
			const inviterName = Inviter?.name

			if (email !== undefined) {
				await ses.send(
					new SendEmailCommand({
						Destination: {
							ToAddresses: [
								name !== undefined ? `"${name}" <${email}>` : email,
							],
						},
						Message: {
							Body: {
								Text: {
									Data: `Hei ${name ?? invitedUserId},\n\n${
										inviterName ?? authContext.sub
									} has invited you to the project ${projectId} as a ${role}.\n\nPlease go to your projects page to accept the invite using the code ${
										res.id
									}.`,
								},
							},
							Subject: {
								Data: `[teamstatus.space] You have been invited to the project ${projectId}`,
							},
						},
						Source: fromEmail,
					}),
				)
			}
		}

		return res
	},
	() => StatusCode.CREATED,
)
