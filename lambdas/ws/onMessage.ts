export const handler = async (event: {
	connectionId: string
	domain: string
	stage: string
	params: URLSearchParams
}): Promise<{ statusCode: number }> => {
	console.log(JSON.stringify({ event }))
	return { statusCode: 200 }
}
