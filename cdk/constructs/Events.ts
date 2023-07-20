import { aws_sns as SNS } from 'aws-cdk-lib'

import { Construct } from 'constructs'

export class Events extends Construct {
	public readonly topic: SNS.Topic

	constructor(parent: Construct) {
		super(parent, 'Events')

		this.topic = new SNS.Topic(this, 'topic')
	}
}
