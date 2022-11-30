namespace MigrationAssistant.Functions.QueryExecutor;

public class StatementResult
{
    public long Duration { get; set; }
    public bool IsSucceeded { get; protected set; }
    public string? ErrorMessage { get; protected set; }
    public DateTime ExecutionTime { get; set; }

    public static StatementResult Success(long duration, DateTime executionTime) => new StatementResult { IsSucceeded = true, Duration = duration, ExecutionTime = executionTime };
    public static StatementResult Failed(long duration, DateTime executionTime, string errorMessage) => new StatementResult { IsSucceeded = false, Duration = duration, ExecutionTime = executionTime, ErrorMessage = errorMessage };
}