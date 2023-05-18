import type { JwtPayload, SignOptions } from 'jsonwebtoken'
import jwt from 'jsonwebtoken'

export const create =
	({ signingKey }: { signingKey: string }) =>
	({ email, subject }: { email: string; subject?: string }): string => {
		const options: SignOptions = {
			algorithm: 'ES256',
			allowInsecureKeySizes: false,
			expiresIn: 24 * 60 * 60, // seconds
		}
		if (subject !== undefined) {
			options.subject = subject
		}
		return jwt.sign(
			{
				email,
			},
			signingKey,
			options,
		)
	}

export const verifyUserToken =
	({ verificationKey }: { verificationKey: string }): VerifyTokenUserFn =>
	(token: string): UserAuthContext => {
		const { sub } = jwt.verify(token, verificationKey) as JwtPayload
		if (sub === undefined)
			throw new Error(`Token not authorized (missing subject)!`)
		const { email } = jwt.decode(token) as { email: string }
		if (email === undefined) throw new Error(`Token is missing email payload!`)
		return { sub, email }
	}

export const verifyToken =
	({ verificationKey }: { verificationKey: string }): VerifyTokenFn =>
	(token: string): EmailAuthContext => {
		jwt.verify(token, verificationKey)
		const { email } = jwt.decode(token) as { email: string }
		if (email === undefined) throw new Error(`Token is missing email payload!`)
		return { email }
	}

export type UserAuthContext = {
	email: string
	sub: string
}
export type EmailAuthContext = {
	email: string
}

export type VerifyTokenUserFn = (token: string) => UserAuthContext
export type VerifyTokenFn = (token: string) => EmailAuthContext
