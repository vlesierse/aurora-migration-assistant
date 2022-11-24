import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { IResource, Resource } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CfnReplicationSubnetGroup } from 'aws-cdk-lib/aws-dms';

/**
 * Interface for a cluster subnet group.
 */
export interface IReplicationSubnetGroup extends IResource {
  /**
   * The name of the replication subnet group.
   * @attribute
   */
  readonly replicationSubnetGroupName: string;
}

/**
 * Properties for creating a ReplicationSubnetGroup.
 */
export interface ReplicationSubnetGroupProps {
  /**
   * Description of the subnet group.
   */
  readonly description: string;

  /**
   * The VPC to place the subnet group in.
   */
  readonly vpc: ec2.IVpc;

  /**
   * Which subnets within the VPC to associate with this group.
   *
   * @default - private subnets
   */
  readonly vpcSubnets?: ec2.SubnetSelection;
}

/**
 * Class for creating a Redshift cluster subnet group
 *
 * @resource AWS::Redshift::ClusterSubnetGroup
 */
export class ReplicationSubnetGroup extends Resource implements IReplicationSubnetGroup {

  /**
   * Imports an existing subnet group by name.
   */
  public static fromReplicationSubnetGroupName(scope: Construct, id: string, clusterSubnetGroupName: string): IReplicationSubnetGroup {
    return new class extends Resource implements IReplicationSubnetGroup {
      public readonly replicationSubnetGroupName = clusterSubnetGroupName;
    }(scope, id);
  }

  public readonly replicationSubnetGroupName: string;

  constructor(scope: Construct, id: string, props: ReplicationSubnetGroupProps) {
    super(scope, id);

    const { subnetIds } = props.vpc.selectSubnets(props.vpcSubnets ?? { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS });

    const subnetGroup = new CfnReplicationSubnetGroup(this, 'Default', {
      replicationSubnetGroupDescription: props.description,
      subnetIds,
    });

    this.replicationSubnetGroupName = subnetGroup.ref;
  }
}
