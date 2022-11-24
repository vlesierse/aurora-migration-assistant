#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MigrationStack } from '../lib/migration-stack';
import { FoundationStack } from '../lib/foundation-stack';


const app = new cdk.App();
const stackName = app.node.tryGetContext('stack-name') || 'AuroraMigrationAssistant';

const foundation = new FoundationStack(app, stackName, {
  vpcId: app.node.tryGetContext('vpc'),
  disableBastion: app.node.tryGetContext('disable-bastion') === 'true'
});

new MigrationStack(app, stackName + '-Migration', {
  vpc: foundation.vpc,
  databaseName: app.node.tryGetContext('database-name') || 'appdb',
  databaseSnapshot: app.node.tryGetContext('snapshot'),
  databaseInstanceType: app.node.tryGetContext('instance-type'),
  artifactsBucket: foundation.artifactsBucket,
  bastionInstance: foundation.bastionInstance,
});