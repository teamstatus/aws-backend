import type { SNSEvent } from 'aws-lambda'

export const handler = async (event: SNSEvent): Promise<void> => {
	console.log(JSON.stringify(event))
}
