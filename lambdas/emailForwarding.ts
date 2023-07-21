import type { SESEvent } from 'aws-lambda'
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { simpleParser } from 'mailparser'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const s3 = new S3Client({})
const ses = new SESClient({})
const Bucket = process.env.BUCKET_NAME ?? ''
const fromEmail = process.env.FROM_EMAIL ?? 'notification@teamstatus.space'
const adminEmail = process.env.ADMIN_EMAIL ?? 'm@coderbyheart.com'

export const handler = async (event: SESEvent): Promise<void> => {
	console.log(JSON.stringify({ event }, null, 2))
	for (const mail of event.Records) {
		const {
			destination, // e.g.  ['premium@teamstatus.space'], 't194b6t5nbuesjn902s2ev1jm18u8110e5ecpsg1',
			messageId, // e.g. 't194b6t5nbuesjn902s2ev1jm18u8110e5ecpsg1',
		} = mail.ses.mail

		const {
			returnPath /* e.g. : 'Markus.Tacker@nordicsemi.no', */,
			from /* e.g. : ['"Tacker, Markus" <Markus.Tacker@nordicsemi.no>'], */,
			subject /* e.g. : 'Test', */,
		} = mail.ses.mail.commonHeaders
		const {
			spamVerdict: { status: spamVerdict },
			virusVerdict: { status: virusVerdict },
			// spfVerdict: { status: spfVerdict },
			// dkimVerdict: { status: dkimVerdict },
			// dmarcVerdict: { status: dmarcVerdict },
		} = mail.ses.receipt

		const bodyIsSafe = virusVerdict === 'PASS' && spamVerdict === 'PASS'
		let body: string | undefined = undefined
		if (!bodyIsSafe) {
			body = await getSignedUrl(
				s3,
				new GetObjectCommand({
					Bucket,
					Key: messageId,
				}),
				{ expiresIn: 60 * 60 * 24 * 7 },
			)
		} else {
			try {
				const { Body } = await s3.send(
					new GetObjectCommand({
						Bucket,
						Key: messageId,
					}),
				)
				if (Body !== undefined)
					body = (await simpleParser(await Body.transformToString())).text ?? ''
			} catch (error) {
				console.error(error)
			}
		}

		await ses.send(
			new SendEmailCommand({
				Destination: {
					ToAddresses: [adminEmail],
				},
				Message: {
					Body: {
						Text: {
							Data:
								body ??
								(await getSignedUrl(
									s3,
									new GetObjectCommand({
										Bucket,
										Key: messageId,
									}),
									{ expiresIn: 60 * 60 * 24 * 7 },
								)),
						},
					},
					Subject: {
						Data: `[${destination[0]}] › ${subject}`,
					},
				},
				ReplyToAddresses: [from?.[0] ?? returnPath],
				Source: fromEmail,
			}),
		)
	}
}
