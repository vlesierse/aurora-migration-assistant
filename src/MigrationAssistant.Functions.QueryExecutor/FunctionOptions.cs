namespace MigrationAssistant.Functions.QueryExecutor;

public class FunctionOptions
{
    public string? ResultStreamName { get; set; } = Environment.GetEnvironmentVariable("RESULT_STREAM_NAME");
    public string? DatabaseName { get; set; } = Environment.GetEnvironmentVariable("DATABASE_NAME");
    public string DatabaseHost { get; set; } = Environment.GetEnvironmentVariable("DATABASE_HOST") ?? "localhost";
    public string DatabasePort { get; set; } = Environment.GetEnvironmentVariable("DATABASE_PORT") ?? "1433";
    public string DatabaseEngine { get; set; } = Environment.GetEnvironmentVariable("DATABASE_ENGINE") ?? "sqlserver";
    public string? DatabaseUsername { get; set; } = Environment.GetEnvironmentVariable("DATABASE_USERNAME");
    public string? DatabasePassword { get; set; } = Environment.GetEnvironmentVariable("DATABASE_PASSWORD");
}