namespace MigrationAssistant.Functions.QueryLoader;

public class QueryLoaderEvent
{
    public string S3ObjectKey { get; set; }
    public string S3ObjectBucketName { get; set; }
}