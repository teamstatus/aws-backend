import { IAMClient } from '@aws-sdk/client-iam'
import { App } from 'aws-cdk-lib'
import pJson from '../../package.json' with { type: 'json' }
import { ensureGitHubOIDCProvider } from '@bifravst/ci'
import { CIStack } from './CIStack.ts'

const repoUrl = new URL(pJson.repository.url)
const repository = {
	owner: repoUrl.pathname.split('/')[1] ?? 'bifravst',
	repo:
		repoUrl.pathname.split('/')[2]?.replace(/\.git$/, '') ??
		'public-parameter-registry-aws-js',
}

const stackNamePrefix = process.env.STACK_NAME_PREFIX ?? 'teamstatus'
class CiApp extends App {
	public constructor(props: ConstructorParameters<typeof CIStack>[2]) {
		super()

		new CIStack(this, `${stackNamePrefix}-backend-ci`, props)
	}
}

new CiApp({
	repository,
	gitHubOICDProviderArn: await ensureGitHubOIDCProvider({
		iam: new IAMClient({}),
	}),
})
