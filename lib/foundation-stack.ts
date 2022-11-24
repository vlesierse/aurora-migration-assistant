import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Stack } from 'aws-cdk-lib';

export interface FoundationStackProps extends cdk.StackProps {
  vpcId?: string;
  disableBastion: boolean;
}

export class FoundationStack extends cdk.Stack {
  public readonly vpc: ec2.IVpc;
  public readonly artifactsBucket: s3.IBucket;
  public readonly bastionInstance?: ec2.IInstance;

  constructor(scope: Construct, id: string, props: FoundationStackProps) {
    super(scope, id, props);

    const { disableBastion } = props;
    this.vpc = props.vpcId ? ec2.Vpc.fromLookup(this, 'VPC', { vpcId: props.vpcId }) : new ec2.Vpc(this, 'VPC');
    this.vpc.addGatewayEndpoint('S3Gateway', { service: ec2.GatewayVpcEndpointAwsService.S3 });

    this.artifactsBucket = new s3.Bucket(this, 'Artifacts', {});    

    if (!disableBastion) {
      this.bastionInstance = new ec2.BastionHostLinux(this, 'Bastion', { vpc: this.vpc });
    }
  }
}
