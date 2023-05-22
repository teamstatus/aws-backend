import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
} from 'aws-lambda'
import { corsHeaders } from './corsHeaders.js'

export const handler = async (
	event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
	console.log(JSON.stringify(event))
	const response: APIGatewayProxyResultV2 = {
		isBase64Encoded: false,
		statusCode: 200,
		headers: corsHeaders(event),
	}
	console.log(JSON.stringify({ response }))
	return response
}
