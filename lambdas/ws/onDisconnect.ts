export const handler = async (_event: {
	connectionId: string
	domain: string
	stage: string
	params: URLSearchParams
}): Promise<{ statusCode: number }> => {
	return { statusCode: 200 }
}
