import { emailAuthRequestPipe } from './requestPipe.js'

export const handler = emailAuthRequestPipe(
	(_) => ({}),
	async (_, authContext) => authContext,
)
