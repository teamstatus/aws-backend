import type { UserAuthContext } from '../core/auth.js'
import { emailAuthRequestPipe } from './requestPipe.js'

export const handler = emailAuthRequestPipe(
	(_) => ({}),
	async (_, authContext) => ({
		email: authContext.email,
		id: (authContext as UserAuthContext).sub,
	}),
)
