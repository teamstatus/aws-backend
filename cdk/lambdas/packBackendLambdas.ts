import { packLambdaFromPath, type PackedLambda } from './packLambdaFromPath.js'

export type BackendLambdas = {
	loginRequest: PackedLambda
	pinLogin: PackedLambda
	apiAuthorizer: PackedLambda
}

export const packBackendLambdas = async (): Promise<BackendLambdas> => ({
	loginRequest: await packLambdaFromPath(
		'loginRequest',
		'lambdas/loginRequest.ts',
	),
	pinLogin: await packLambdaFromPath('pinLogin', 'lambdas/pinLogin.ts'),
	apiAuthorizer: await packLambdaFromPath(
		'apiAuthorizer',
		'lambdas/apiAuthorizer.ts',
	),
})
