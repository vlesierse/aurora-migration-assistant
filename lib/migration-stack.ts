import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import {
  Replication,
  EndpointType,
  ReplicationTask,
  ITaskSettings,
} from "./constructs/aws-dms";

export interface MigrationStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  databaseName: string;
  databaseSnapshot?: string;
  databaseInstanceType?: string;
  artifactsBucket: s3.IBucket;
  bastionInstance?: ec2.IInstance;
}

export class MigrationStack extends cdk.Stack {
  public readonly sqlServerInstance: rds.DatabaseInstance;

  constructor(scope: Construct, id: string, props: MigrationStackProps) {
    super(scope, id, props);

    const {
      vpc,
      databaseName,
      databaseSnapshot,
      artifactsBucket,
      bastionInstance,
    } = props;

    // SQL Server Instance
    const databaseInstanceType = props.databaseInstanceType
      ? new ec2.InstanceType(props.databaseInstanceType)
      : ec2.InstanceType.of(ec2.InstanceClass.R6I, ec2.InstanceSize.XLARGE);
    const sqlServerInstance = databaseSnapshot
      ? this.createSqlServerInstanceFromSnapshot(vpc, databaseSnapshot, databaseInstanceType)
      : this.createSqlServerInstance(vpc, artifactsBucket, databaseInstanceType);
    this.sqlServerInstance = sqlServerInstance;

    // Aurora Cluster
    const auroraCluster = new rds.DatabaseCluster(this, "AuroraCluster", {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_14_5,
      }),
      instances: 1,
      instanceProps: {
        vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        instanceType: databaseInstanceType,
      },
      credentials: rds.Credentials.fromGeneratedSecret("dbadmin", {
        excludeCharacters: " %+~`#$&*()|[]{}:;<>?!'/@\"\\,^",
      }),
      parameters: {
        "rds.babelfish_status": "on",
        "babelfishpg_tsql.migration_mode": "multi-db",
      },
    });
    if (bastionInstance) {
      auroraCluster.connections.allowDefaultPortFrom(
        bastionInstance,
        "Bastion can connect to Aurora PostgreSQL"
      );
      auroraCluster.connections.allowFrom(
        bastionInstance,
        ec2.Port.tcp(1433),
        "Bastion can connect to Aurora Babelfish"
      );
      sqlServerInstance.connections.allowDefaultPortFrom(
        bastionInstance,
        "Bastion can connect to SQL Server"
      );
      new cdk.CfnOutput(this, "SQLServerSessionManagerCommand", {
        value: `aws ssm start-session --region ${
          cdk.Stack.of(this).region
        } --target ${
          bastionInstance.instanceId
        } --document-name AWS-StartPortForwardingSessionToRemoteHost --parameters host="${
          sqlServerInstance.instanceEndpoint.hostname
        }",portNumber="${
          sqlServerInstance.instanceEndpoint.port
        }",localPortNumber="1433"`,
      });
      new cdk.CfnOutput(this, "AuroraPostgresSessionManagerCommand", {
        value: `aws ssm start-session --region ${
          cdk.Stack.of(this).region
        } --target ${
          bastionInstance.instanceId
        } --document-name AWS-StartPortForwardingSessionToRemoteHost --parameters host="${
          auroraCluster.clusterEndpoint.hostname
        }",portNumber="${
          auroraCluster.clusterEndpoint.port
        }",localPortNumber="5432"`,
      });
      new cdk.CfnOutput(this, "AuroraBabelfishSessionManagerCommand", {
        value: `aws ssm start-session --region ${
          cdk.Stack.of(this).region
        } --target ${
          bastionInstance.instanceId
        } --document-name AWS-StartPortForwardingSessionToRemoteHost --parameters host="${
          auroraCluster.clusterEndpoint.hostname
        }",portNumber="1433",localPortNumber="1433"`,
      });
    }

    // Database Migration Service
    const replication = new Replication(this, "Replication", { vpc });
    const targetEndpoint = replication.addDatabaseClusterEndpoint("Target", {
      endpointType: EndpointType.TARGET,
      databaseCluster: auroraCluster,
      secret: auroraCluster.secret,
      databaseName: "babelfish_db",
    });
    const sourceEndpoint = replication.addDatabaseInstanceEndpoint("Source", {
      endpointType: EndpointType.SOURCE,
      databaseInstance: sqlServerInstance,
      secret: sqlServerInstance.secret,
      databaseName,
    });
    const taskSettings: ITaskSettings = {
      Logging: {
        EnableLogging: true,
      },
      TargetMetadata: {
        TargetSchema: databaseName.toLowerCase() + "_dbo",
      },
      FullLoadSettings: {
        TargetTablePrepMode: "TRUNCATE_BEFORE_LOAD",
        CreatePkAfterFullLoad: false,
      },
      ValidationSettings: {
        EnableValidation: false,
      },
    };
    const tableMappings = {
      rules: [
        {
          "rule-id": "11",
          "rule-name": "lowercase-table-names",
          "rule-type": "transformation",
          "rule-target": "table",
          "object-locator": { "schema-name": "dbo", "table-name": "%" },
          "rule-action": "convert-lowercase",
          value: null,
          "old-value": null,
        },
        {
          "rule-id": "1",
          "rule-name": "include-all-tables",
          "rule-type": "selection",
          "object-locator": { "schema-name": "dbo", "table-name": "%" },
          "rule-action": "include",
          filters: [],
        },
      ],
    };
    new ReplicationTask(this, "ReplicationTask", {
      replication,
      sourceEndpoint,
      targetEndpoint,
      taskSettings,
      tableMappings,
    });
  }

  private createSqlServerInstance(
    vpc: ec2.IVpc,
    artifactsBucket: s3.IBucket,
    instanceType: ec2.InstanceType
  ): rds.DatabaseInstance {
    const instance = new rds.DatabaseInstance(this, "SQLServerInstance", {
      engine: rds.DatabaseInstanceEngine.sqlServerSe({
        version: rds.SqlServerEngineVersion.VER_14,
      }),
      credentials: rds.Credentials.fromGeneratedSecret("dbadmin"),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      instanceType,
      licenseModel: rds.LicenseModel.LICENSE_INCLUDED,
      s3ImportBuckets: [artifactsBucket],
    });
    return instance;
  }

  private createSqlServerInstanceFromSnapshot(
    vpc: ec2.IVpc,
    snapshotIdentifier: string,
    instanceType: ec2.InstanceType
  ): rds.DatabaseInstance {
    const instance = new rds.DatabaseInstanceFromSnapshot(
      this,
      "SQLServerInstance",
      {
        engine: rds.DatabaseInstanceEngine.sqlServerSe({
          version: rds.SqlServerEngineVersion.VER_14,
        }),
        credentials: rds.SnapshotCredentials.fromGeneratedSecret("dbadmin", {
          excludeCharacters: " %+~`#$&*()|[]{}:;<>?!'/@\"\\,^",
        }),
        licenseModel: rds.LicenseModel.LICENSE_INCLUDED,
        vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        instanceType,
        snapshotIdentifier,
      }
    );
    return instance;
  }
}
