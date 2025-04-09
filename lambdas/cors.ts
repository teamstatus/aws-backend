import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
} from 'aws-lambda'
import { corsHeaders } from './corsHeaders.ts'

export const handler = async (
	event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
	const response: APIGatewayProxyResultV2 = {
		isBase64Encoded: false,
		statusCode: 200,
		headers: corsHeaders(event),
	}
	return response
}
