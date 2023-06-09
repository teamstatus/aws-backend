import type { APIGatewayProxyEventHeaders } from 'aws-lambda'

const allowedDomains = [/^https?:\/\/localhost:/, /.*\.teamstatus\.space$/]
const defaultOrigin = 'https://teamstatus.space'
const origin = (event: { headers: APIGatewayProxyEventHeaders }): string => {
	const origin = event.headers.origin ?? defaultOrigin.toString()

	if (allowedDomains.find((rx) => rx.test(origin)) !== undefined) return origin

	return defaultOrigin
}

export const corsHeaders = ({
	headers,
}: {
	headers: APIGatewayProxyEventHeaders
}): {
	'Access-Control-Allow-Credentials': true
	'Access-Control-Allow-Headers': 'content-type, accept, if-match'
	'Access-Control-Allow-Methods': 'PUT, DELETE, POST, GET, PATCH'
	'Access-Control-Allow-Origin': string
	'Access-Control-Max-Age': 600
	Vary: 'Origin'
} => ({
	'Access-Control-Allow-Credentials': true,
	'Access-Control-Allow-Origin': origin({ headers }),
	'Access-Control-Allow-Methods': 'PUT, DELETE, POST, GET, PATCH',
	'Access-Control-Allow-Headers': 'content-type, accept, if-match',
	'Access-Control-Max-Age': 600,
	// https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Origin#cors_and_caching
	Vary: 'Origin',
})
