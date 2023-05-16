import { IAMClient } from '@aws-sdk/client-iam'
import { App } from 'aws-cdk-lib'
import pJSON from '../../package.json'
import { ensureGitHubOIDCProvider } from '../ensureGitHubOIDCProvider.js'
import { CIStack } from './CIStack.js'

const repoUrl = new URL(pJSON.repository.url)
const repository = {
	owner: repoUrl.pathname.split('/')[1] ?? 'bifravst',
	repo:
		repoUrl.pathname.split('/')[2]?.replace(/\.git$/, '') ??
		'public-parameter-registry-aws-js',
}

const stackNamePrefix = process.env.STACK_NAME_PREFIX ?? 'teamstatus'
class CIApp extends App {
	public constructor(props: ConstructorParameters<typeof CIStack>[2]) {
		super()

		new CIStack(this, `${stackNamePrefix}-backend-ci`, props)
	}
}

new CIApp({
	repository,
	gitHubOICDProviderArn: await ensureGitHubOIDCProvider({
		iam: new IAMClient({}),
	}),
})
