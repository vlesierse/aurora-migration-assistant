import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as opensearch from 'aws-cdk-lib/aws-opensearchservice';
import * as identitypool from '@aws-cdk/aws-cognito-identitypool-alpha';
import { Construct } from "constructs";

export interface OpenSearchProps {
  vpc?: ec2.IVpc;
}

export class OpenSearch extends Construct {
  public readonly domain: opensearch.IDomain;

  constructor(scope: Construct, id: string, props: OpenSearchProps = {}) {
    super(scope, id);

    const { vpc } = props;
    const userPool = new cognito.UserPool(this, 'UserPool', {
      selfSignUpEnabled: false,
      signInAliases: { email: true, username: false },
      autoVerify: { email: true },
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });
    userPool.addDomain('Domain', { cognitoDomain: { domainPrefix: 'migration-assistant-os-' + cdk.Stack.of(this).account } });
    const identityPool = new identitypool.IdentityPool(this, 'IdentityPool', {
      allowUnauthenticatedIdentities: false,
      authenticationProviders: {
        userPools: [new identitypool.UserPoolAuthenticationProvider({ userPool })],
      }
    });
    const cognitoConfigurationRole = new iam.Role(this, "CognitoConfigurationRole", {
      assumedBy: new iam.ServicePrincipal('es.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonESCognitoAccess")]
    });
    this.domain = new opensearch.Domain(this, 'Domain', {
      vpc,
      
      version: opensearch.EngineVersion.OPENSEARCH_1_3,
      capacity: {
        dataNodeInstanceType: "t3.medium.search",
      },
      cognitoDashboardsAuth: {
        role: cognitoConfigurationRole,
        userPoolId: userPool.userPoolId,
        identityPoolId: identityPool.identityPoolId,
      },
      enforceHttps: true,
    });
    this.domain.grantReadWrite(identityPool.authenticatedRole);

    new cdk.CfnOutput(this, 'OpenSearchEndpoint', { value: `https://${this.domain.domainEndpoint}/_dashboards` });
  }
}