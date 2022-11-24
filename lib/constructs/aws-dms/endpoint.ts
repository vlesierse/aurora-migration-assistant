import { Resource } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CfnEndpoint } from 'aws-cdk-lib/aws-dms';
import { IDatabaseInstance, IDatabaseCluster } from 'aws-cdk-lib/aws-rds';

export interface IEndpoint {
  readonly endpointName: string;
}

export enum EndpointType {
  SOURCE = 'source',
  TARGET = 'target',
}

export interface EndpointProps {
  readonly endpointName?: string;
  readonly endpointType: EndpointType;
  readonly engineName: string;
  readonly databaseName: string;
  readonly username?: string;
  readonly password?: string;
  readonly port?: number;
  readonly serverName?: string;
}

export class Endpoint extends Resource implements IEndpoint {
  
  public readonly endpointName: string;

  constructor(scope: Construct, id: string, props: EndpointProps) {
    super(scope, id);

    const endpoint = new CfnEndpoint(this, 'Endpoint', {
      endpointIdentifier: props.endpointName,
      endpointType: props.endpointType,
      engineName: props.engineName,
      databaseName: props.databaseName,
      username: props.username,
      password: props.password,
      port: props.port,
      serverName: props.serverName,
    });

    this.endpointName = endpoint.ref;
  }
}