export const handler = (_event: {
	connectionId: string
	domain: string
	stage: string
	params: URLSearchParams
}): { statusCode: number } => ({ statusCode: 200 })
