import type { JwtPayload, SignOptions } from 'jsonwebtoken'
import jwt from 'jsonwebtoken'

export const create =
	({ signingKey }: { signingKey: string }) =>
	({ email, sub }: { email: string; sub?: string }): string => {
		const options: SignOptions = {
			algorithm: 'ES256',
			allowInsecureKeySizes: false,
			expiresIn: 24 * 60 * 60, // seconds
		}
		if (sub !== undefined) {
			options.subject = sub
		}
		return jwt.sign(
			{
				email,
			},
			signingKey,
			options,
		)
	}

export const verifyToken =
	({ verificationKey }: { verificationKey: string }): VerifyTokenFn =>
	(token: string): EmailAuthContext | UserAuthContext => {
		const { email } = jwt.decode(token) as { email: string }
		if (email === undefined) throw new Error(`Token is missing email payload!`)
		const { sub } = jwt.verify(token, verificationKey) as JwtPayload
		return { sub, email }
	}

export type UserAuthContext = EmailAuthContext & {
	sub: string
}
export type EmailAuthContext = {
	email: string
}

export type VerifyTokenFn = (
	token: string,
) => EmailAuthContext | UserAuthContext
