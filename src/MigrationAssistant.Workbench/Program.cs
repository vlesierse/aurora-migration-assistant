using System.Text;
using Amazon.Lambda.KinesisEvents;
using Amazon.Lambda.TestUtilities;

/*
using MigrationAssistant.Functions.QueryLoader;

var function = new Function(new FunctionOptions { QueryStreamName = "AMAEncore-TestBench-QueryStreamB2BF2DBD-Jq80SIbQzcHk" });
await function.FunctionHandler(
    new QueryLoaderEvent { 
        S3ObjectKey = "ReadTrace_0_133070265302890000.xel",
        S3ObjectBucketName = "amaencore-artifacts82dd59a1-xcbm4x75xg8s"
    },
    new TestLambdaContext()
);*/

using MigrationAssistant.Functions.QueryExecutor;


var function = new Function();

var message = """
    {
    "TestsetId": "0c6bc391-8507-4265-aeb7-5b12a2e1fbcf",
    "QueryId": "b996b18e-2b80-4c59-a993-1f4e1a435d9e",
    "SessionId": 1277,
    "Statement": "DECLARE @SubscriptionIds table (Id uniqueidentifier NOT NULL PRIMARY KEY)\r\n;\r\nSELECT Subscriptions.EntryID AS ID, Subscriptions.timestamp AS TimestampBytes, Subscriptions.Division, Subscriptions.sysmodified, Subscriptions.Number AS SubscriptionNumber, Subscriptions.Description AS SubscriptionDescription, Subscriptions.YourRef AS SubscriptionYourRef, Subscriptions.Notes AS SubscriptionNotes FROM Subscriptions INNER JOIN @SubscriptionIds pft ON (pft.Id = EntryID) ORDER BY timestamp DESC"
    }
    """;
using var messageData = new MemoryStream(Encoding.UTF8.GetBytes(message));
var records = new List<KinesisEvent.KinesisEventRecord>
{
    new KinesisEvent.KinesisEventRecord {
        EventId = "shardId-000000000000:49635625185326330032883675490145400920528269576780120066",
        EventName = "aws:kinesis:record",
        Kinesis = new KinesisEvent.Record {
            Data = messageData,
        }
    }
};
await function.FunctionHandler(new KinesisEvent { Records = records}, new TestLambdaContext());