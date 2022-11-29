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

    private IAmazonKinesisFirehose _firehoseClient;
    private string _resultStreamName;

    public Function()
        : this(new AmazonKinesisFirehoseClient(), new FunctionOptions())
    { }

    public Function(IAmazonKinesisFirehose firehoseClient, FunctionOptions options)
    {
        _firehoseClient = firehoseClient;
        _resultStreamName = options.ResultstreamName ?? throw new ArgumentException(nameof(FileOptions), "RESULTS_STREAM_NAME environment variable is not set");
    }

    public async Task FunctionHandler(KinesisEvent kinesisEvent, ILambdaContext context)
    {
        context.Logger.LogInformation($"Beginning to process {kinesisEvent.Records.Count} records...");

        foreach (var record in kinesisEvent.Records)
        {
            context.Logger.LogInformation($"Event ID: {record.EventId}");
            context.Logger.LogInformation($"Event Name: {record.EventName}");

            string recordData = GetRecordContents(record.Kinesis);
            context.Logger.LogInformation($"Record Data:");
            context.Logger.LogInformation(recordData);
        }
        await FlushResultsStream(); // Flush the remaining records
        context.Logger.LogInformation("Stream processing complete.");
    }

    private string GetRecordContents(KinesisEvent.Record streamRecord)
    {
        using (var reader = new StreamReader(streamRecord.Data, Encoding.UTF8))
        {
            return reader.ReadToEnd();
        }
    }

    private List<Record> _firehoseRecords = new();
    private long _firehoseRecordSize = 0;
    private const int MAX_RECORDS_PER_PUT = 500;
    private const long MAX_RECORDS_SIZE = (4 * 1024 * 1024) - (16 * 1024); // 5 MB - 16 KB

    private async Task WriteToResultsStream(ResultRecord record)
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