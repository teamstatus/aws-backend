import {
	create,
	type EmailAuthContext,
	type UserAuthContext,
} from '../core/auth.js'

export const tokenCookie = async ({
	authContext,
	signingKey,
}: {
	authContext: UserAuthContext | EmailAuthContext
	signingKey: string
}): Promise<string> =>
	[
		`token=${create({ signingKey })(authContext)}`,
		`Expires=${new Date(Date.now() + 24 * 60 * 60 * 1000).toString()}`,
		`Path=/`,
		`HttpOnly`,
		`SameSite=None`,
		`Secure`,
	].join('; ')
