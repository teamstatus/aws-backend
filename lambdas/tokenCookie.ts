import {
	create,
	type EmailAuthContext,
	type UserAuthContext,
} from '../core/auth.js'

export const tokenCookie = async ({
	authContext,
	signingKey,
	cookieProps,
}: {
	authContext: UserAuthContext | EmailAuthContext
	signingKey: string
	cookieProps?: string[]
}): Promise<string> =>
	[
		`token=${create({ signingKey })(authContext)}`,
		`Expires=${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toString()}`,
		`Path=/`,
		`HttpOnly`,
		`SameSite=None`,
		`Secure`,
		...(cookieProps ?? []),
	]
		.filter((v) => v !== undefined)
		.join('; ')

export const expiredTokenCooked = async ({
	cookieProps,
}: {
	cookieProps?: string[]
}): Promise<string> =>
	[
		`token=`,
		`Expires=${new Date(Date.now() - 60 * 1000).toString()}`,
		`Path=/`,
		`HttpOnly`,
		`SameSite=None`,
		`Secure`,
		...(cookieProps ?? []),
	]
		.filter((v) => v !== undefined)
		.join('; ')
