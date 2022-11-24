import { Resource } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CfnReplicationTask } from 'aws-cdk-lib/aws-dms';
import { IEndpoint } from './endpoint';
import { IReplication } from './replication';

export interface ITaskSettings {
  TargetMetadata?: ITargetMetadata,
  FullLoadSettings?: IFullLoadSettings,
  Logging?: ILogging,
  ControlTablesSettings?: IControlTablesSettings,
  StreamBufferSettings?: IStreamBufferSettings,
  ChangeProcessingDdlHandlingPolicy?: IChangeProcessingDdlHandlingPolicy,
  ErrorBehavior?: IErrorBehavior,
  ChangeProcessingTuning?: IChangeProcessingTuning,
  PostProcessingRules?: any; // Missing definition for PostProcessingRules https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-dms-endpoint-elasticsearchsettings.html
  CharactorSetSettings?: ICharactorSetSettings
  LoopbackPreventionSettings?: ILoopbackPreventionSettings
  BeforeImageSettings?: IBeforeImageSettings
  ValidationSettings?: IValidationSettings,
  TTSettings?: ITTSettings;
  FailTaskWhenCleanTaskResourceFailed?: boolean
}

export interface ITargetMetadata {
  TargetSchema?: string;
  SupportLobs?: boolean;
  FullLobMode?: boolean;
  LobChunkSize?: number;
  LimitedSizeLobMode?: boolean;
  LobMaxSize?: number;
  InlineLobMaxSize?: number;
  LoadMaxFileSize?: number;
  ParallelLoadThreads?: number;
  ParallelLoadBufferSize?: number;
  BatchApplyEnabled?: boolean;
  TaskRecoveryTableEnabled?: boolean;
  ParallelLoadQueuesPerThread?: number;
  ParallelApplyThreads?: number;
  ParallelApplyBufferSize?: number;
  ParallelApplyQueuesPerThread?: number;
}

export interface IFullLoadSettings {
  TargetTablePrepMode?: string;
  CreatePkAfterFullLoad?: boolean;
  StopTaskCachedChangesApplied?: boolean;
  StopTaskCachedChangesNotApplied?: boolean;
  MaxFullLoadSubTasks?: number;
  TransactionConsistencyTimeout?: number;
  CommitRate?: number;
}

export interface ILogging {
  EnableLogging?: boolean;
  LogComponents?: ILogComponent[];
}

export interface ILogComponent {
  Id: string;
  Severity: string;
}

export interface IControlTablesSettings {
  ControlSchema?: string;
  HistoryTimeslotInMinutes?: number;
  HistoryTableEnabled?: boolean;
  SuspendedTablesTableEnabled?: boolean;
  StatusTableEnabled?: boolean;
}

export interface IStreamBufferSettings {
  StreamBufferCount?: number;
  StreamBufferSizeInMB?: number;
}

export interface IChangeProcessingDdlHandlingPolicy {
  HandleSourceTableDropped?: boolean;
  HandleSourceTableTruncated?: boolean;
  HandleSourceTableAltered?: boolean;
}

export interface IErrorBehavior {
  DataErrorPolicy?: string;
  DataTruncationErrorPolicy?: string;
  DataErrorEscalationPolicy?: string;
  DataErrorEscalationCount?: number;
  TableErrorPolicy?: string;
  TableErrorEscalationPolicy?: string;
  TableErrorEscalationCount?: number;
  RecoverableErrorCount?: number;
  RecoverableErrorInterval?: number;
  RecoverableErrorThrottling?: boolean;
  RecoverableErrorThrottlingMax?: 1800,
  ApplyErrorDeletePolicy?: string;
  ApplyErrorInsertPolicy?: string;
  ApplyErrorUpdatePolicy?: string;
  ApplyErrorEscalationPolicy?: string;
  ApplyErrorEscalationCount?: number;
  FullLoadIgnoreConflicts?: boolean;
}

export interface IChangeProcessingTuning {
  BatchApplyPreserveTransaction?: boolean;
  BatchApplyTimeoutMin?: number;
  BatchApplyTimeoutMax?: number;
  BatchApplyMemoryLimit?: number;
  BatchSplitSize?: number;
  MinTransactionSize?: number;
  CommitTimeout?: number;
  MemoryLimitTotal?: number;
  MemoryKeepTime?: number;
  StatementCacheSize?: number;
}

export interface ICharactorSetSettings {
  CharacterReplacements: ICharacterReplacements[]
  CharacterSetSupport: ICharacterSetSupport
}

export interface ICharacterReplacements {
  SourceCharacterCodePoint: number;
  TargetCharacterCodePoint: number;
}

export interface ICharacterSetSupport {
  CharacterSet: string;
  ReplaceWithCharacterCodePoint: number;
}

export interface ILoopbackPreventionSettings {
  EnableLoopbackPrevention?: boolean;
  SourceSchema?: string;
  TargetSchema?: string;
}

export interface IBeforeImageSettings {
  EnableBeforeImage?: boolean;
  FieldName?: string;
  ColumnFilter?: string;
}

export interface IValidationSettings {
  EnableValidation?: boolean;
  ValidationMode?: string;
  ThreadCount?: number;
  PartitionSize?: number;
  FailureMaxCount?: number;
  RecordFailureDelayInMinutes?: number;
  RecordSuspendDelayInMinutes?: number;
  MaxKeyColumnSize?: number;
  TableFailureMaxCount?: number;
  ValidationOnly?: boolean;
  HandleCollationDiff?: boolean;
  RecordFailureDelayLimitInMinutes?: number;
  SkipLobColumns?: boolean;
  ValidationPartialLobSize?: number;
  ValidationQueryCdcDelaySeconds?: number;
}

export interface ITTSettings {
  EnableTT?: boolean;
  TTS3Settings?: ITTS3Settings;
  TTRecordSettings?: TTRecordSettings;
}

export interface ITTS3Settings {
  EncryptionMode?: string;
  ServerSideEncryptionKmsKeyId?: string;
  ServiceAccessRoleArn?: string;
  BucketName?: string;
  BucketFolder?: string;
  EnableDeletingFromS3OnTaskDelete?: boolean;
}

export interface TTRecordSettings {
  EnableRawData?: boolean;
  OperationsToLog?: string;
  MaxRecordSize?: number;
}

export interface IReplicationTask {
  readonly taskName: string;
}

export interface ReplicationTaskProps {
  readonly taskName?: string;
  readonly replication: IReplication;
  readonly sourceEndpoint: IEndpoint;
  readonly targetEndpoint: IEndpoint;
  readonly migrationType?: MigrationType;
  readonly tableMappings?: any;
  readonly taskSettings?: ITaskSettings;
}

export enum MigrationType {
  CDC = 'cdc',
  FULL_LOAD = 'full-load',
  FULL_LOAD_AND_CDC = 'full-load-and-cdc',
}

export class ReplicationTask extends Resource implements IReplicationTask {
  
  public readonly taskName: string;

  constructor(scope: Construct, id: string, props: ReplicationTaskProps) {
    super(scope, id);

    const endpoint = new CfnReplicationTask(this, 'Task', {
      replicationTaskIdentifier: props.taskName,
      sourceEndpointArn: props.sourceEndpoint.endpointName,
      targetEndpointArn: props.targetEndpoint.endpointName,
      replicationInstanceArn: props.replication.replicationName,
      replicationTaskSettings: JSON.stringify(props.taskSettings ?? {}),
      migrationType: props.migrationType ?? MigrationType.FULL_LOAD,
      tableMappings: JSON.stringify(props.tableMappings ?? {}),
    });

    this.taskName = endpoint.ref;
  }
}