namespace MigrationAssistant.Functions.QueryExecutor;

public class FunctionOptions
{
    public string? ResultstreamName { get; set; } = Environment.GetEnvironmentVariable("RESULTS_STREAM_NAME");
}