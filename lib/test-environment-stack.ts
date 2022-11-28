import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as kinesis from 'aws-cdk-lib/aws-kinesis';
import { Construct } from 'constructs';
import { DotNetFunction } from './constructs/aws-lambda-dotnet';

export interface TestEnvironmentStackProps extends cdk.StackProps {
  readonly vpc: ec2.IVpc;
  readonly queryStream: kinesis.IStream;
  readonly databaseName: string;
  readonly resultsStreamName: string;
  readonly auroraSnapshot: string;
  readonly auroraInstanceType?: string;
  readonly bastionInstance?: ec2.IInstance;
  readonly sqlServerSnapshot?: string;
  readonly sqlServerInstanceType?: string;
}

export class TestEnvironmentStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: TestEnvironmentStackProps) {
    super(scope, id, props);

    const { vpc, queryStream, databaseName, resultsStreamName } = props;

    const auroraInstanceType = props.auroraInstanceType
      ? new ec2.InstanceType(props.auroraInstanceType)
      : ec2.InstanceType.of(ec2.InstanceClass.R6I, ec2.InstanceSize.LARGE);
    /*const sqlserverInstanceType = props.sqlServerInstanceType
      ? new ec2.InstanceType(props.sqlServerInstanceType)
      : ec2.InstanceType.of(ec2.InstanceClass.R6I, ec2.InstanceSize.LARGE);*/

    const auroraCluster = new rds.DatabaseClusterFromSnapshot(this, "AuroraCluster", {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_14_5,
      }),
      snapshotIdentifier: props.auroraSnapshot,
      snapshotCredentials: rds.SnapshotCredentials.fromGeneratedSecret("dbadmin", {
        excludeCharacters: " %+~`#$&*()|[]{}:;<>?!'/@\"\\,^",
      }),
      instances: 1,
      instanceProps: {
        vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        instanceType: auroraInstanceType,
      },
      parameters: {
        "rds.babelfish_status": "on",
        "babelfishpg_tsql.migration_mode": "multi-db",
      },
    });
  }
}
