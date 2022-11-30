using System.Text;
using System.Text.Json;
using Amazon.KinesisFirehose;
using Amazon.KinesisFirehose.Model;
using Amazon.Lambda.Core;
using Amazon.Lambda.KinesisEvents;
using MigrationAssistant.Shared.Records;

// Assembly attribute to enable the Lambda function's JSON input to be converted into a .NET class.
[assembly: LambdaSerializer(typeof(Amazon.Lambda.Serialization.SystemTextJson.DefaultLambdaJsonSerializer))]

namespace MigrationAssistant.Functions.QueryExecutor;

public class Function
{

    private SqlServerClient _sqlServerClient;
    private IAmazonKinesisFirehose _firehoseClient;    
    private string _databaseEngine;
    private string _resultStreamName;
    

    public Function()
        : this(new FunctionOptions())
    { }

    public Function(FunctionOptions options)
        : this(new AmazonKinesisFirehoseClient(), options)
    { }

    public Function(IAmazonKinesisFirehose firehoseClient, FunctionOptions options)
    {
        _databaseEngine = options.DatabaseEngine;
        _firehoseClient = firehoseClient;
        _resultStreamName = options.ResultStreamName ?? throw new ArgumentException(nameof(FileOptions), "RESULT_STREAM_NAME environment variable is not set");
        _sqlServerClient = new SqlServerClient($"Server={options.DatabaseHost},{options.DatabasePort};Database={options.DatabaseName};User Id={options.DatabaseUsername};Password={options.DatabasePassword};");
    }

    public async Task FunctionHandler(KinesisEvent kinesisEvent, ILambdaContext context)
    {
        context.Logger.LogInformation($"Beginning to process {kinesisEvent.Records.Count} records...");
        foreach (var record in kinesisEvent.Records.Select(GetStatementRecord))
        {
            if (record != null && record.Statement != null) {
                var result = await _sqlServerClient.ExecuteStatement(record.SessionId, record.Statement);
                await WriteToResultsStream(new StatementResultRecord(record) {
                    Success = result.IsSucceeded,
                    ErrorMessage = result.ErrorMessage,
                    ExecutionTime = result.ExecutionTime,
                    Duration = result.Duration,
                    DatabaseEngine = _databaseEngine
                });
            }
        }
        await FlushResultsStream(); // Flush the remaining records
        await _sqlServerClient.CloseConnections; // Close all connections
        context.Logger.LogInformation("Stream processing complete.");
    }

    private StatementRecord? GetStatementRecord(KinesisEvent.KinesisEventRecord record)
    {
        using (var reader = new StreamReader(record.Kinesis.Data, Encoding.UTF8))
        return JsonSerializer.Deserialize<StatementRecord>(reader.ReadToEnd());
    }

    private Task<string> GetRecordContentsAsync(KinesisEvent.Record streamRecord)
    {
        using (var reader = new StreamReader(streamRecord.Data, Encoding.UTF8))
        return reader.ReadToEndAsync();
    }

    private List<Record> _firehoseRecords = new();
    private long _firehoseRecordSize = 0;
    private const int MAX_RECORDS_PER_PUT = 500;
    private const long MAX_RECORDS_SIZE = (4 * 1024 * 1024) - (16 * 1024); // 5 MB - 16 KB

    private async Task WriteToResultsStream(StatementResultRecord record)
    {
        var entry = new Record
        {
            Data = new MemoryStream(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(record)))
        };
        if (_firehoseRecordSize + entry.Data.Length >= MAX_RECORDS_SIZE || _firehoseRecords.Count >= 500)
        {
            await FlushResultsStream();
        }
        _firehoseRecords.Add(entry);
        _firehoseRecordSize += entry.Data.Length;
    }

    private async Task FlushResultsStream()
    {
        if (_firehoseRecords.Count > 0)
        {
            await _firehoseClient.PutRecordBatchAsync(_resultStreamName, _firehoseRecords);
            _firehoseRecords.Clear();
            _firehoseRecordSize = 0;
        }
    }
}