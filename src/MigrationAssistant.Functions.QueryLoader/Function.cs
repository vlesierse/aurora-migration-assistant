using Amazon.Lambda.Core;
using Amazon.S3;
using Amazon.Kinesis;
using Microsoft.SqlServer.XEvent.XELite;
using MigrationAssistant.Shared;
using MigrationAssistant.Shared.Records;
using Amazon.Kinesis.Model;
using System.Text.Json;
using System.Text;

// Assembly attribute to enable the Lambda function's JSON input to be converted into a .NET class.
[assembly: LambdaSerializer(typeof(Amazon.Lambda.Serialization.SystemTextJson.DefaultLambdaJsonSerializer))]

namespace MigrationAssistant.Functions.QueryLoader;

public class Function
{

    private IAmazonS3 _s3Client;
    private IAmazonKinesis _kinesisClient;
    private string _kinesisStreamName;

    /// <summary>
    /// Default constructor. This constructor is used by Lambda to construct the instance. When invoked in a Lambda environment
    /// the AWS credentials will come from the IAM role associated with the function and the AWS region will be set to the
    /// region the Lambda function is executed in.
    /// </summary>
    public Function()
        : this(Environment.GetEnvironmentVariable("KINESIS_STREAM_NAME"))
    { }

    /// <summary>
    /// Default constructor. This constructor is used by Lambda to construct the instance. When invoked in a Lambda environment
    /// the AWS credentials will come from the IAM role associated with the function and the AWS region will be set to the
    /// region the Lambda function is executed in.
    /// </summary>
    public Function(string? kinesisStreamName)
        : this(new AmazonS3Client(), new AmazonKinesisClient(), kinesisStreamName)
    { }

    /// <summary>
    /// Constructs an instance with a preconfigured S3 client. This can be used for testing the outside of the Lambda environment.
    /// </summary>
    /// <param name="s3Client"></param>
    public Function(IAmazonS3 s3Client, IAmazonKinesis kinesisClient, string? kinesisStreamName)
    {
        _s3Client = s3Client;
        _kinesisClient = kinesisClient;
        _kinesisStreamName = kinesisStreamName ?? throw new ArgumentNullException(nameof(kinesisStreamName));
    }

    public async Task FunctionHandler(QueryLoaderEvent @event, ILambdaContext context)
    {
        context.Logger.LogInformation($"Beginning to load with Extended Events {@event.S3ObjectBucketName}/{@event.S3ObjectKey}...");
        
        var testsetId = Guid.NewGuid();

        // Load the Extended Events file into memory from S3
        var response = await _s3Client.GetObjectAsync(@event.S3ObjectBucketName, @event.S3ObjectKey);
        using var responseStream = response.ResponseStream;
        // Read extended events from the response stream
        var xeStream = new XEFileEventStreamer(responseStream);
        await xeStream.ReadEventStream(
            () => {
                Console.WriteLine("Headers found");
                return Task.CompletedTask;
            },
            async xevent => {
                var batchText = xevent.Fields["batch_text"]?.ToString();
                var sessionId = (int?)xevent.Actions["session_id"];
                if (!string.IsNullOrEmpty(batchText) && sessionId.HasValue)
                {
                    await WriteToQueryStream(new QueryRecord
                    {
                        TestsetId = testsetId,
                        QueryId = Guid.NewGuid(),
                        SessionId = sessionId.Value,
                        QueryText = batchText
                    });
                }
            },
            CancellationToken.None);
        await FlushQueryStream(); // Flush the remaining records
        context.Logger.LogInformation("Loading complete.");
    }
    

    private List<PutRecordsRequestEntry> _putRecordsRequestEntries = new();
    private long _putRecordsRequestEntrySize = 0;

    private const int MAX_RECORDS_PER_PUT = 500;
    private const long MAX_RECORDS_SIZE = 5 * 1024 * 1024; // 5 MB

    private async Task WriteToQueryStream(QueryRecord record)
    {
        var entry = new PutRecordsRequestEntry
        {
            Data = new MemoryStream(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(record))),
            PartitionKey = record.SessionId.ToString()
        };
        if (_putRecordsRequestEntrySize + entry.Data.Length >= MAX_RECORDS_SIZE || _putRecordsRequestEntries.Count >= 500)
        {
            await FlushQueryStream();
        }
        _putRecordsRequestEntries.Add(entry);
        _putRecordsRequestEntrySize += entry.Data.Length;
    }

    private async Task FlushQueryStream()
    {
        if (_putRecordsRequestEntries.Count > 0)
        {
            await _kinesisClient.PutRecordsAsync(new PutRecordsRequest
            {
                StreamName = _kinesisStreamName,
                Records = _putRecordsRequestEntries
            });
            _putRecordsRequestEntries.Clear();
            _putRecordsRequestEntrySize = 0;
        }
    }
}