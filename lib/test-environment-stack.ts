import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as kinesis from 'aws-cdk-lib/aws-kinesis';
import * as eventsources from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';
import { DotNetFunction } from './constructs/aws-lambda-dotnet';

export interface TestEnvironmentStackProps extends cdk.StackProps {
  readonly vpc: ec2.IVpc;
  readonly queryStream: kinesis.IStream;
  readonly databaseName: string;
  readonly resultsStreamName: string;
  readonly auroraSnapshot: string;
  readonly auroraInstanceType?: string;
  readonly auroraInstanceTypes?: string[];
  readonly bastionInstance?: ec2.IInstance;
  readonly sqlServerSnapshot?: string;
  readonly sqlServerInstanceType?: string;
}

export class TestEnvironmentStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: TestEnvironmentStackProps) {
    super(scope, id, props);

    const { vpc, queryStream, databaseName, resultsStreamName, bastionInstance } = props;

    const auroraInstanceType = props.auroraInstanceType
      ? new ec2.InstanceType(props.auroraInstanceType)
      : ec2.InstanceType.of(ec2.InstanceClass.R6I, ec2.InstanceSize.LARGE);
    /*const sqlserverInstanceType = props.sqlServerInstanceType
      ? new ec2.InstanceType(props.sqlServerInstanceType)
      : ec2.InstanceType.of(ec2.InstanceClass.R6I, ec2.InstanceSize.LARGE);*/
    const auroraInstanceTypes = props.auroraInstanceTypes?.map((t) => new ec2.InstanceType(t)) || [auroraInstanceType];

    const snapshotCredentials = rds.SnapshotCredentials.fromGeneratedSecret("dbadmin", {
      excludeCharacters: " %+~`#$&*()|[]{}:;<>?!'/@\"\\,^",
    });
    auroraInstanceTypes.forEach((instanceType, index) => {
      const auroraCluster = new rds.DatabaseClusterFromSnapshot(this, "AuroraCluster" + index, {
        engine: rds.DatabaseClusterEngine.auroraPostgres({
          version: rds.AuroraPostgresEngineVersion.VER_14_5,
        }),
        snapshotIdentifier: props.auroraSnapshot,
        snapshotCredentials,
        instances: 1,
        instanceProps: {
          vpc,
          vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
          instanceType: instanceType,
          enablePerformanceInsights: true,
        },
        cloudwatchLogsExports: ["postgresql"],
        cloudwatchLogsRetention: logs.RetentionDays.ONE_WEEK,
        parameters: {
          "rds.babelfish_status": "on",
          "babelfishpg_tsql.migration_mode": "multi-db",
        },
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });
      if (bastionInstance) {
        auroraCluster.connections.allowDefaultPortFrom(bastionInstance, "Bastion can connect to Aurora PostgreSQL");
        auroraCluster.connections.allowFrom(bastionInstance, ec2.Port.tcp(1433), "Bastion can connect to Aurora Babelfish");
      }

      const queryExecutorFunction = new DotNetFunction(this, 'QueryExecutorFunction' + index, {
        projectDir: 'src/MigrationAssistant.Functions.QueryExecutor',
        environment: {
          RESULTS_STREAM_NAME: resultsStreamName,
          DATABASE_NAME: databaseName,
          DATABASE_HOST: auroraCluster.clusterEndpoint.hostname,
          DATABASE_USER: auroraCluster.secret!.secretValueFromJson('username').unsafeUnwrap(),
          DATABASE_PASSWORD: auroraCluster.secret!.secretValueFromJson('password').unsafeUnwrap(),
        },
        timeout: cdk.Duration.minutes(1),
        retryAttempts: 0,
      });
      queryExecutorFunction.addEventSource(new eventsources.KinesisEventSource(queryStream, { startingPosition: lambda.StartingPosition.LATEST }));
      queryExecutorFunction.role?.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonKinesisFirehoseFullAccess'));
    });
  }
  
}
