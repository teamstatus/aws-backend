import { packLambdaFromPath, type PackedLambda } from './packLambdaFromPath.js'

export type BackendLambdas = {
	loginRequest: PackedLambda
}

export const packBackendLambdas = async (): Promise<BackendLambdas> => ({
	loginRequest: await packLambdaFromPath(
		'loginRequest',
		'lambdas/loginRequest.ts',
	),
})
