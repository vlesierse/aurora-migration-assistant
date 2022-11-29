namespace MigrationAssistant.Functions.QueryLoader;

public class FunctionOptions
{
    public string? QueryStreamName { get; set; } = Environment.GetEnvironmentVariable("QUERY_STREAM_NAME");
}