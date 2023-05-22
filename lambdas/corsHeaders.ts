import type { APIGatewayProxyEventV2 } from 'aws-lambda'

const allowedDomains = [/^localhost$/, /.*\.teamstatus\.space$/]
const defaultOrigin = 'https://teamstatus.space'
const origin = (event: APIGatewayProxyEventV2): string => {
	const origin = event.headers.origin ?? defaultOrigin.toString()

	if (allowedDomains.find((rx) => rx.test(origin) !== undefined)) return origin

	return defaultOrigin
}

export const corsHeaders = (
	event: APIGatewayProxyEventV2,
): {
	[header: string]: boolean | number | string
} => ({
	'Access-Control-Allow-Credentials': true,
	'Access-Control-Allow-Origin': origin(event),
	'Access-Control-Allow-Methods': 'PUT, DELETE, POST, GET, OPTIONS',
	'Access-Control-Allow-Headers': 'content-type, accept',
	'Access-Control-Max-Age': 600,
	// https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Origin#cors_and_caching
	Vary: 'Origin',
})
