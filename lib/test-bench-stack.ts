import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kinesis from 'aws-cdk-lib/aws-kinesis';
import * as firehose from 'aws-cdk-lib/aws-kinesisfirehose';
import { Construct } from 'constructs';
import { OpenSearch } from './constructs/opensearch';
import { DotNetFunction } from '@xaaskit-cdk/aws-lambda-dotnet';

export interface TestBenchStackProps extends cdk.StackProps {
  readonly artifactsBucket: s3.IBucket;
  readonly concurrency?: number;
}

export class TestBenchStack extends cdk.Stack {
  public readonly queryStream: kinesis.IStream;
  public readonly resultsStreamName: string;

  constructor(scope: Construct, id: string, props: TestBenchStackProps) {
    super(scope, id, props);

    const { artifactsBucket, concurrency } = props;

    // Query Loader
    this.queryStream = new kinesis.Stream(this, 'QueryStream', { shardCount: concurrency });
    const queryLoaderFunction = new DotNetFunction(this, 'QueryLoaderFunction', {
      projectDir: 'src/MigrationAssistant.Functions.QueryLoader',
      environment: {
        QUERY_STREAM_NAME: this.queryStream.streamName,
      },
      timeout: cdk.Duration.minutes(1),
    });
    this.queryStream.grantWrite(queryLoaderFunction);
    artifactsBucket.grantRead(queryLoaderFunction);

    // Results
    const opensearch = new OpenSearch(this, 'OpenSearch');
    const resultsStreamRole = new iam.Role(this, 'ResultsStreamRole', {
      assumedBy: new iam.ServicePrincipal('firehose.amazonaws.com')
    });
    artifactsBucket.grantWrite(resultsStreamRole);
    resultsStreamRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['es:*'],
        resources: [
          opensearch.domain.domainArn,
          opensearch.domain.domainArn + '/*',
        ],
      })
    );
    resultsStreamRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        resources: [
          "arn:aws:logs:*:*:log-group:/aws/kinesisfirehose/MigrationAssistant-ResultsStream:*",
        ],
        actions: ["logs:PutLogEvents"],
      })
    );
    
    const resultsStream = new firehose.CfnDeliveryStream(this, 'ResultsStream', {
      deliveryStreamType: 'DirectPut',
      amazonopensearchserviceDestinationConfiguration: {
        domainArn: opensearch.domain.domainArn,
        indexName: 'results',
        s3BackupMode: "AllDocuments",
        indexRotationPeriod: 'OneDay',
        bufferingHints: {
          intervalInSeconds: 60,
          sizeInMBs: 1,
        },
        retryOptions: {
          durationInSeconds: 300,
        },
        roleArn: resultsStreamRole.roleArn,
        cloudWatchLoggingOptions: {
          enabled: true,
          logGroupName: "/aws/kinesisfirehose/MigrationAssistant-ResultsStream",
          logStreamName: "OpenSearchDelivery",
        },
        s3Configuration: {
          bucketArn: artifactsBucket.bucketArn,
          prefix: 'results/',
          bufferingHints: {
            intervalInSeconds: 300,
            sizeInMBs: 5,
          },
          compressionFormat: "GZIP",
          roleArn: resultsStreamRole.roleArn,
          cloudWatchLoggingOptions: {
            enabled: true,
            logGroupName: "/aws/kinesisfirehose/MigrationAssistant-ResultsStream",
            logStreamName: "S3Delivery",
          },
        },
      }
    });
    resultsStream.node.addDependency(resultsStreamRole);
    this.resultsStreamName = resultsStream.ref;
  }
}
