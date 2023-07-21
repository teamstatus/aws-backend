import type { SNSEvent } from 'aws-lambda'
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'

const ses = new SESClient({})
const fromEmail = process.env.FROM_EMAIL ?? 'notification@teamstatus.space'
const adminEmail = process.env.ADMIN_EMAIL ?? 'm@coderbyheart.com'

export const handler = async ({ Records }: SNSEvent): Promise<void> => {
	console.log(JSON.stringify({ Records }))

	for (const { Sns } of Records) {
		const event = JSON.parse(Sns.Message)
		await ses.send(
			new SendEmailCommand({
				Destination: {
					ToAddresses: [adminEmail],
				},
				Message: {
					Body: {
						Text: {
							Data: Object.entries(event)
								.map(([k, v]) => `${k}: ${v}`)
								.join('\n'),
						},
					},
					Subject: {
						Data: `[teamstatus.space] › ${
							Sns.MessageAttributes['type']?.Value ?? 'Unknown event'
						}`,
					},
				},
				Source: fromEmail,
			}),
		)
	}
}
