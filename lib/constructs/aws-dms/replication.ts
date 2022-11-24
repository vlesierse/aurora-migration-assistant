import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { IReplicationSubnetGroup, ReplicationSubnetGroup } from "./subnet-group";
import { IResource, Resource } from "aws-cdk-lib";
import { CfnReplicationInstance } from "aws-cdk-lib/aws-dms";
import { Endpoint, EndpointProps, EndpointType, IEndpoint } from "./endpoint";

export interface IReplication extends IResource, ec2.IConnectable {
  readonly vpc: ec2.IVpc;
  readonly vpcSubnets?: ec2.SubnetSelection;
  readonly replicationName: string;
}

export interface ReplicationProps {
  readonly vpc: ec2.IVpc;
  readonly vpcSubnets?: ec2.SubnetSelection;
  readonly instanceType?: ec2.InstanceType;
  readonly securityGroups?: ec2.ISecurityGroup[];
  readonly replicationName?: string;
  /**
   * A replication subnet group to use with this cluster.
   *
   * @default - a new subnet group will be created.
   */
   readonly subnetGroup?: IReplicationSubnetGroup;
}


export interface DatabaseEndpointProps {
  readonly endpointName?: string;
  readonly databaseName: string;
  readonly endpointType: EndpointType;
  readonly secret?: secretsmanager.ISecret;
  readonly username?: string;
  readonly password?: string;
  readonly port?: number;
}

export interface DatabaseInstanceEndpointProps extends DatabaseEndpointProps {
  readonly databaseInstance: rds.IDatabaseInstance;
}

export interface DatabaseClusterEndpointProps extends DatabaseEndpointProps {
  readonly databaseCluster: rds.IDatabaseCluster;
}

export class Replication extends Resource implements IReplication {
  protected readonly securityGroups: ec2.ISecurityGroup[];
  
  readonly connections: ec2.Connections;

  public readonly vpc: ec2.IVpc;
  public readonly vpcSubnets?: ec2.SubnetSelection;
  public readonly replicationName: string;

  private readonly instance: CfnReplicationInstance;

  constructor(scope: Construct, id: string, props: ReplicationProps) {
    super(scope, id);

    this.vpc = props.vpc;
    this.vpcSubnets = props.vpcSubnets;
    const subnetGroup = props.subnetGroup ?? new ReplicationSubnetGroup(this, 'Subnets', {
      description: `Subnets for ${id} Replication instance`,
      vpc: this.vpc,
      vpcSubnets: this.vpcSubnets,
    });

    this.securityGroups = props.securityGroups ?? [
      new ec2.SecurityGroup(this, 'SecurityGroup', {
        description: 'RDS security group',
        vpc: props.vpc,
      }),
    ];
    const securityGroupIds = this.securityGroups.map(sg => sg.securityGroupId);

    const instanceType = props.instanceType || ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL);


    // Launch an instance in the subnet group
    this.instance = new CfnReplicationInstance(this, 'Instance', {
      replicationInstanceIdentifier: props.replicationName,
      replicationInstanceClass: 'dms.' + instanceType.toString(),
      replicationSubnetGroupIdentifier: subnetGroup.replicationSubnetGroupName,
      vpcSecurityGroupIds: securityGroupIds,
    });

    this.replicationName = this.instance.ref;
    this.connections = new ec2.Connections({ securityGroups: this.securityGroups });
  }

  public addDatabaseClusterEndpoint(id: string, props: DatabaseClusterEndpointProps) : IEndpoint {
    const { databaseCluster, databaseName, endpointName, endpointType } = props;
    const endpointProps: EndpointProps = {
      endpointName,
      endpointType,
      databaseName,
      engineName: databaseCluster.engine?.engineType ?? rds.DatabaseInstanceEngine.MYSQL.engineType,
      serverName: databaseCluster.clusterEndpoint.hostname,
      port: props.port ?? databaseCluster.clusterEndpoint.port,
      username: props.username ?? props.secret?.secretValueFromJson('username')?.unsafeUnwrap(),
      password: props.password ?? props.secret?.secretValueFromJson('password')?.unsafeUnwrap(),
    }
    databaseCluster.connections.allowFrom(this, ec2.Port.tcp(props.port ?? databaseCluster.clusterEndpoint.port));
    return new Endpoint(this, id, endpointProps);
  }

  public addDatabaseInstanceEndpoint(id: string, props: DatabaseInstanceEndpointProps) : IEndpoint {
    const { databaseInstance, databaseName, endpointName, endpointType } = props;
    const endpointProps: EndpointProps = {
      endpointName,
      endpointType,
      databaseName,
      engineName: this.resolveInstanceEngineName(databaseInstance.engine),
      serverName: databaseInstance.instanceEndpoint.hostname,
      port: props.port ?? databaseInstance.instanceEndpoint.port,
      username: props.username ?? props.secret?.secretValueFromJson('username')?.unsafeUnwrap(),
      password: props.password ?? props.secret?.secretValueFromJson('password')?.unsafeUnwrap(),
    }
    this.connections.allowTo(databaseInstance, ec2.Port.tcp(props.port ?? databaseInstance.instanceEndpoint.port));
    return new Endpoint(this, id, endpointProps);
  }

  private resolveInstanceEngineName(engine?: rds.IInstanceEngine) : string {
    if (!engine) return 'unknown';
    if (engine.engineType.startsWith('sqlserver')) return 'sqlserver';
    if (engine.engineType.startsWith('oracle')) return 'oracle';
    return engine.engineType;
  }
}