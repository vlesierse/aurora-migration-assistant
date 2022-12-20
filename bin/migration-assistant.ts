#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MigrationStack } from '../lib/migration-stack';
import { FoundationStack } from '../lib/foundation-stack';
import { TestBenchStack } from '../lib/test-bench-stack';
import { TestEnvironmentStack } from '../lib/test-environment-stack';


const app = new cdk.App();
const stackName = app.node.tryGetContext('stack-name') || 'AuroraMigrationAssistant';

const foundation = new FoundationStack(app, stackName, {
  vpcId: app.node.tryGetContext('vpc'),
  disableBastion: app.node.tryGetContext('disable-bastion') === 'true'
});

new MigrationStack(app, stackName + '-Migration', {
  vpc: foundation.vpc,
  databaseName: app.node.tryGetContext('database-name') || 'appdb',
  databaseSnapshot: app.node.tryGetContext('database-snapshot'),
  databaseInstanceType: app.node.tryGetContext('database-instance-type'),
  artifactsBucket: foundation.artifactsBucket,
  bastionInstance: foundation.bastionInstance,
});

const bench = new TestBenchStack(app, stackName + '-TestBench', {
  artifactsBucket: foundation.artifactsBucket,
  concurrency: parseInt(app.node.tryGetContext('concurrency') || "1"),
});

new TestEnvironmentStack(app, stackName + '-TestEnvironment', {
  vpc: foundation.vpc,
  databaseName: app.node.tryGetContext('database-name') || 'appdb',
  auroraSnapshot: app.node.tryGetContext('aurora-snapshot'),
  auroraInstanceType: app.node.tryGetContext('aurora-instance-type'),
  sqlServerSnapshot: app.node.tryGetContext('sqlserver-snapshot'),
  sqlServerInstanceType: app.node.tryGetContext('sqlserver-instance-type'),
  bastionInstance: foundation.bastionInstance,
  queryStream: bench.queryStream,
  resultsStreamName: bench.resultsStreamName,
  artifactsBucket: foundation.artifactsBucket,
});